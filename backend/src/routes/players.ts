import { Router } from "express";
import { prisma } from "../lib/prisma";
import { enqueuePlayer } from "../lib/queue";
import { broadcastTournamentUpdate } from "../socket";
import { attachUser, AuthedRequest, canManageTournament, requireAuth } from "../lib/auth";

export const playersRouter = Router();

// Admin registration: name + skill level (BEGINNER / AVERAGE / ADVANCE)
playersRouter.post("/", async (req: AuthedRequest, res) => {
  const { tournamentId, name, contact, skillLevel, userId } = req.body;
  const playerName = typeof name === "string" ? name.trim() : "";
  if (typeof tournamentId !== "string" || !tournamentId || playerName.length < 2 || playerName.length > 80 || !["BEGINNER", "AVERAGE", "ADVANCE"].includes(skillLevel) || (userId !== undefined && typeof userId !== "string")) {
    return res.status(400).json({ error: "tournamentId, name, and valid skillLevel are required" });
  }
  if (!(await canManageTournament(req, tournamentId))) return res.status(403).json({ error: "You can only edit players in tournaments you own." });
  if (userId) {
    const account = await prisma.user.findFirst({
      where: { id: userId, role: "PLAYER", isBlocked: false },
      select: { id: true },
    });
    if (!account) return res.status(404).json({ error: "Active player account not found." });
    const existingPlayer = await prisma.player.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { id: true },
    });
    if (existingPlayer) return res.status(409).json({ error: "This account is already registered for the tournament." });
  }
  let player;
  try {
    player = await prisma.player.create({
      data: {
        tournamentId,
        name: playerName,
        contact: typeof contact === "string" ? contact.trim() || null : null,
        skillLevel,
        ...(userId ? { userId } : {}),
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002" && userId) {
      return res.status(409).json({ error: "This account is already registered for the tournament." });
    }
    throw error;
  }

  // For random-pairing tournaments, newly registered players go straight
  // into the waiting queue so they're eligible for the next draw.
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (tournament?.type === "RANDOM_PAIRING") {
    await enqueuePlayer(tournamentId, player.id);
  }

  broadcastTournamentUpdate(tournamentId, "players:changed");
  res.status(201).json(player);
});

playersRouter.get("/search-users", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const tournamentId = typeof req.query.tournamentId === "string" ? req.query.tournamentId : "";
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  if (!tournamentId) return res.status(400).json({ error: "tournamentId is required." });
  if (!(await canManageTournament(req, tournamentId))) return res.status(403).json({ error: "You can only manage players in tournaments you own." });
  if (query.length < 2) return res.json([]);

  const users = await prisma.user.findMany({
    where: {
      role: "PLAYER",
      isBlocked: false,
      playerProfiles: { none: { tournamentId } },
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { playerProfiles: { some: { name: { contains: query, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      username: true,
      playerProfiles: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { name: true },
      },
    },
    orderBy: { username: "asc" },
    take: 10,
  });
  res.json(users.map(({ playerProfiles, ...user }) => ({
    ...user,
    displayName: playerProfiles[0]?.name ?? null,
  })));
});

playersRouter.get("/", attachUser, async (req: AuthedRequest, res) => {
  const { tournamentId } = req.query;
  const players = await prisma.player.findMany({
    where: {
      tournamentId: String(tournamentId),
      ...(req.query.mine === "true" && req.userId ? { userId: req.userId } : {}),
    },
    include: {
      gamePlayers: { where: { game: { status: "FINISHED" } }, select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const canSeeContacts = req.userId ? await canManageTournament(req, String(tournamentId)) : false;
  res.json(players.map(({ gamePlayers, contact, ...player }) => ({
    ...player,
    ...(canSeeContacts ? { contact } : {}),
    gamesPlayed: gamePlayers.length,
  })));
});

// Admin can edit skill level or mark a player as LEFT (opens them up for substitution elsewhere)
playersRouter.patch("/:id", async (req, res) => {
  const { skillLevel, status, name, contact } = req.body;
  const existing = await prisma.player.findUnique({ where: { id: req.params.id }, select: { tournamentId: true } });
  if (!existing) return res.status(404).json({ error: "Player not found." });
  if (!(await canManageTournament(req as AuthedRequest, existing.tournamentId))) return res.status(403).json({ error: "You can only edit players in tournaments you own." });
  const player = await prisma.player.update({
    where: { id: req.params.id },
    data: { skillLevel, status, name, contact },
  });
  if (status === "WAITING") {
    const tournament = await prisma.tournament.findUnique({ where: { id: player.tournamentId } });
    if (tournament?.type === "RANDOM_PAIRING" && player.joinStatus === "APPROVED") await enqueuePlayer(player.tournamentId, player.id);
  }
  broadcastTournamentUpdate(player.tournamentId, "players:changed");
  res.json(player);
});

playersRouter.patch("/:id/approval", async (req: AuthedRequest, res) => {
  const { joinStatus } = req.body;
  if (!["PENDING", "APPROVED", "REJECTED"].includes(joinStatus)) {
    return res.status(400).json({ error: "Invalid approval status." });
  }
  const existing = await prisma.player.findUnique({ where: { id: req.params.id }, select: { tournamentId: true } });
  if (!existing) return res.status(404).json({ error: "Player not found." });
  if (!(await canManageTournament(req, existing.tournamentId))) return res.status(403).json({ error: "You can only edit players in tournaments you own." });
  const player = await prisma.player.update({
    where: { id: req.params.id },
    data: { joinStatus, ...(joinStatus === "APPROVED" ? { arrivalAt: new Date() } : {}) },
  });
  if (joinStatus === "REJECTED") await prisma.queueEntry.deleteMany({ where: { tournamentId: player.tournamentId, playerId: player.id } });
  if (joinStatus === "APPROVED") {
    const tournament = await prisma.tournament.findUnique({ where: { id: player.tournamentId } });
    if (tournament?.type === "RANDOM_PAIRING") await enqueuePlayer(player.tournamentId, player.id);
  }
  broadcastTournamentUpdate(player.tournamentId, "players:changed");
  res.json(player);
});

async function permanentlyRemovePlayer(req: AuthedRequest, res: any) {
  const existing = await prisma.player.findUnique({ where: { id: req.params.id }, select: { tournamentId: true } });
  if (!existing) return res.status(404).json({ error: "Player not found." });
  if (!(await canManageTournament(req, existing.tournamentId))) return res.status(403).json({ error: "You can only remove players from tournaments you own." });

  await prisma.$transaction(async (transaction) => {
    await transaction.queueEntry.deleteMany({ where: { playerId: req.params.id } });
    await transaction.gamePlayer.deleteMany({ where: { playerId: req.params.id } });
    await transaction.bracketEntry.deleteMany({ where: { playerAId: req.params.id } });
    await transaction.bracketEntry.updateMany({ where: { playerBId: req.params.id }, data: { playerBId: null } });
    await transaction.player.delete({ where: { id: req.params.id } });
  });

  broadcastTournamentUpdate(existing.tournamentId, "players:changed");
  broadcastTournamentUpdate(existing.tournamentId, "queue:changed");
  res.json({ ok: true });
}

playersRouter.patch("/:id/remove", permanentlyRemovePlayer);

playersRouter.delete("/:id", async (req: AuthedRequest, res) => {
  return permanentlyRemovePlayer(req, res);
});
