import { Player } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { enqueuePlayer, refillUpcomingQueue, assignAllFreeCourts } from "../lib/queue";
import { broadcastTournamentUpdate } from "../socket";
import { AuthedRequest, canManageTournament, requireAuth } from "../lib/auth";

export const queueRouter = Router();

type MyPlayerResult =
  | { kind: "error"; error: string; httpStatus: 400 | 403 | 404 }
  | { kind: "ok"; player: Player };

async function getMyPlayer(req: AuthedRequest, tournamentId: string): Promise<MyPlayerResult> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, type: true },
  });
  if (!tournament) return { kind: "error", error: "Tournament not found.", httpStatus: 404 };
  if (tournament.type !== "RANDOM_PAIRING") {
    return { kind: "error", error: "The player queue is only available for open play.", httpStatus: 400 };
  }
  const player = await prisma.player.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: req.userId! } },
  });
  if (!player) return { kind: "error", error: "No player registration is linked to your account for this open play.", httpStatus: 404 };
  if (player.joinStatus !== "APPROVED") {
    return { kind: "error", error: "Your open-play registration must be approved before you can use the queue.", httpStatus: 403 };
  }
  return { kind: "ok", player };
}

queueRouter.get("/:tournamentId/me", requireAuth, async (req: AuthedRequest, res) => {
  const result = await getMyPlayer(req, req.params.tournamentId);
  if (result.kind === "error") return res.status(result.httpStatus).json({ error: result.error });

  const [queue, gamePlayers] = await Promise.all([
    prisma.queueEntry.findMany({
      where: { tournamentId: req.params.tournamentId },
      select: { playerId: true },
      orderBy: { enqueuedAt: "asc" },
    }),
    prisma.gamePlayer.findMany({
      where: {
        playerId: result.player.id,
        game: { tournamentId: req.params.tournamentId, status: { in: ["UPCOMING", "READY", "IN_PROGRESS", "PAUSED"] } },
      },
      include: {
        game: {
          include: {
            players: { include: { player: { select: { id: true, name: true, skillLevel: true } } } },
            court: true,
          },
        },
      },
    }),
  ]);
  const activeGame = gamePlayers
    .map(({ game }) => game)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null;
  const queueIndex = queue.findIndex((entry) => entry.playerId === result.player.id);

  res.json({
    player: {
      id: result.player.id,
      name: result.player.name,
      status: result.player.status,
      joinStatus: result.player.joinStatus,
      skillLevel: result.player.skillLevel,
    },
    queuePosition: queueIndex < 0 ? null : queueIndex + 1,
    game: activeGame,
  });
});

queueRouter.post("/:tournamentId/me/join", requireAuth, async (req: AuthedRequest, res) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.tournamentId}))`;
    const membership = await tx.tournament.findUnique({
      where: { id: req.params.tournamentId },
      select: { type: true, status: true },
    });
    if (!membership) return { kind: "missing-tournament" as const };
    if (membership.type !== "RANDOM_PAIRING") return { kind: "not-open-play" as const };
    if (membership.status === "COMPLETED") return { kind: "completed" as const };
    const player = await tx.player.findUnique({
      where: { tournamentId_userId: { tournamentId: req.params.tournamentId, userId: req.userId! } },
    });
    if (!player) return { kind: "missing-player" as const };
    if (player.joinStatus !== "APPROVED") return { kind: "not-approved" as const };
    if (!["WAITING", "LEFT"].includes(player.status)) return { kind: "already-assigned" as const };

    const queued = await tx.queueEntry.findUnique({
      where: { tournamentId_playerId: { tournamentId: req.params.tournamentId, playerId: player.id } },
    });
    if (!queued) await enqueuePlayer(req.params.tournamentId, player.id, tx);
    return { kind: queued ? "already-queued" as const : "joined" as const };
  });

  if (result.kind === "missing-tournament") return res.status(404).json({ error: "Tournament not found." });
  if (result.kind === "not-open-play") return res.status(400).json({ error: "The player queue is only available for open play." });
  if (result.kind === "completed") return res.status(409).json({ error: "This open play has ended; the queue is closed." });
  if (result.kind === "missing-player") return res.status(404).json({ error: "No player registration is linked to your account for this open play." });
  if (result.kind === "not-approved") return res.status(403).json({ error: "Your open-play registration must be approved before you can join the queue." });
  if (result.kind === "already-assigned") return res.status(409).json({ error: "You are already assigned to a game or marked as resting." });
  if (result.kind === "joined") {
    broadcastTournamentUpdate(req.params.tournamentId, "queue:changed");
    broadcastTournamentUpdate(req.params.tournamentId, "players:changed");
  }
  res.json({ ok: true });
});

queueRouter.delete("/:tournamentId/me", requireAuth, async (req: AuthedRequest, res) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.tournamentId}))`;
    const player = await tx.player.findUnique({
      where: { tournamentId_userId: { tournamentId: req.params.tournamentId, userId: req.userId! } },
    });
    if (!player) return { kind: "missing-player" as const };
    if (player.joinStatus !== "APPROVED") return { kind: "not-approved" as const };
    const queued = await tx.queueEntry.findUnique({
      where: { tournamentId_playerId: { tournamentId: req.params.tournamentId, playerId: player.id } },
    });
    if (!queued) return { kind: "not-waiting" as const };
    if (player.status !== "WAITING") return { kind: "already-assigned" as const };
    await tx.queueEntry.delete({ where: { id: queued.id } });
    await tx.player.update({ where: { id: player.id }, data: { status: "LEFT" } });
    return { kind: "left" as const };
  });

  if (result.kind === "missing-player") return res.status(404).json({ error: "No player registration is linked to your account for this open play." });
  if (result.kind === "not-approved") return res.status(403).json({ error: "Your open-play registration must be approved before you can leave the queue." });
  if (result.kind === "not-waiting") return res.status(409).json({ error: "You are not currently waiting in the queue." });
  if (result.kind === "already-assigned") return res.status(409).json({ error: "You have already been assigned to a game and cannot leave the queue." });
  broadcastTournamentUpdate(req.params.tournamentId, "queue:changed");
  broadcastTournamentUpdate(req.params.tournamentId, "players:changed");
  res.json({ ok: true });
});

// Public, read-only waiting pool. Keep this response limited to display-safe
// player fields; contact details remain available only through staff APIs.
queueRouter.get("/:tournamentId", async (req: AuthedRequest, res) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: req.params.tournamentId },
    select: { type: true },
  });
  if (!tournament) return res.status(404).json({ error: "Tournament not found." });
  const entries = await prisma.queueEntry.findMany({
    where: { tournamentId: req.params.tournamentId },
    select: {
      id: true,
      playerId: true,
      enqueuedAt: true,
      player: { select: { id: true, name: true, skillLevel: true, status: true } },
    },
    orderBy: { enqueuedAt: "asc" },
  });
  res.json(entries.map((entry, index) => ({ ...entry, position: index + 1 })));
});

queueRouter.patch("/:tournamentId/reorder", async (req, res) => {
  const tournamentId = req.params.tournamentId;
  const playerIds = Array.isArray(req.body?.playerIds) ? req.body.playerIds as string[] : [];

  if (playerIds.length === 0) {
    return res.status(400).json({ error: "Provide an ordered list of player IDs." });
  }

  const queueEntries = await prisma.queueEntry.findMany({
    where: { tournamentId },
    include: { player: true },
    orderBy: { enqueuedAt: "asc" },
  });

  const queueMap = new Map(queueEntries.map((entry) => [entry.playerId, entry]));
  const orderedIds = playerIds.filter((playerId) => queueMap.has(playerId));

  if (orderedIds.length !== queueEntries.length) {
    return res.status(400).json({ error: "Queue order must include every waiting player." });
  }

  const now = Date.now();
  await prisma.$transaction(
    orderedIds.map((playerId, index) =>
      prisma.queueEntry.update({
        where: { tournamentId_playerId: { tournamentId, playerId } },
        data: { enqueuedAt: new Date(now + index * 1000) },
      })
    )
  );

  const updated = await prisma.queueEntry.findMany({
    where: { tournamentId },
    include: { player: true },
    orderBy: { enqueuedAt: "asc" },
  });

  broadcastTournamentUpdate(tournamentId, "queue:reordered", { playerIds: orderedIds });
  broadcastTournamentUpdate(tournamentId, "games:changed");
  res.json(updated);
});

queueRouter.delete("/:tournamentId/player/:playerId", async (req, res) => {
  const { tournamentId, playerId } = req.params;
  await prisma.queueEntry.deleteMany({ where: { tournamentId, playerId } });
  await prisma.player.updateMany({ where: { id: playerId, tournamentId }, data: { status: "LEFT" } });
  broadcastTournamentUpdate(tournamentId, "queue:changed");
  broadcastTournamentUpdate(tournamentId, "players:changed");
  res.json({ ok: true });
});

queueRouter.delete("/:tournamentId", async (req, res) => {
  const { tournamentId } = req.params;
  const entries = await prisma.queueEntry.findMany({ where: { tournamentId }, select: { playerId: true } });
  await prisma.$transaction([
    prisma.queueEntry.deleteMany({ where: { tournamentId } }),
    prisma.player.updateMany({ where: { tournamentId, id: { in: entries.map((entry) => entry.playerId) } }, data: { status: "LEFT" } }),
  ]);
  broadcastTournamentUpdate(tournamentId, "queue:changed");
  broadcastTournamentUpdate(tournamentId, "players:changed");
  broadcastTournamentUpdate(tournamentId, "games:changed");
  res.json({ removed: entries.length });
});

queueRouter.patch("/:tournamentId/replace", async (req, res) => {
  const { tournamentId } = req.params;
  const { playerId, replacementPlayerId } = req.body as { playerId?: string; replacementPlayerId?: string };
  if (!playerId || !replacementPlayerId || playerId === replacementPlayerId) {
    return res.status(400).json({ error: "A queued player and a different replacement are required." });
  }
  const currentPlayer = await prisma.player.findFirst({ where: { id: playerId, tournamentId }, select: { skillLevel: true } });
  const replacement = await prisma.player.findFirst({
    where: {
      id: replacementPlayerId,
      tournamentId,
      joinStatus: "APPROVED",
      skillLevel: currentPlayer?.skillLevel,
      status: { in: ["WAITING", "LEFT"] },
      queueEntries: { none: {} },
    },
  });
  if (!replacement) return res.status(400).json({ error: "Replacement must be an approved player who is not currently playing or queued." });
  const current = await prisma.queueEntry.findUnique({ where: { tournamentId_playerId: { tournamentId, playerId } } });
  if (!current) return res.status(404).json({ error: "Player is no longer waiting in the queue." });

  await prisma.$transaction([
    prisma.queueEntry.delete({ where: { tournamentId_playerId: { tournamentId, playerId } } }),
    prisma.player.update({ where: { id: playerId }, data: { status: "LEFT" } }),
    prisma.player.update({ where: { id: replacementPlayerId }, data: { status: "WAITING" } }),
    prisma.queueEntry.create({ data: { tournamentId, playerId: replacementPlayerId, enqueuedAt: current.enqueuedAt } }),
  ]);
  broadcastTournamentUpdate(tournamentId, "queue:changed");
  broadcastTournamentUpdate(tournamentId, "players:changed");
  res.json({ ok: true });
});

/**
 * "Spin the wheel" / bunot-bunot trigger.
 * Draws eligible skill-based pairings from the waiting pool and creates
 * UPCOMING games out of them, then tries to seat any free courts.
 * The frontend plays the wheel/reveal animation using the returned games
 * before showing them as confirmed on the kiosk.
 */
queueRouter.post("/:tournamentId/draw", async (req, res) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: req.params.tournamentId },
    select: { type: true, status: true },
  });
  if (!tournament) return res.status(404).json({ error: "Tournament not found." });
  if (tournament.type !== "RANDOM_PAIRING") {
    return res.status(400).json({ error: "Bunot-bunot matchmaking is only available for open play." });
  }
  if (tournament.status === "COMPLETED") {
    return res.status(409).json({ error: "This open play has ended; no more matches can be drawn." });
  }
  const result = await refillUpcomingQueue(req.params.tournamentId);
  await assignAllFreeCourts(req.params.tournamentId);
  broadcastTournamentUpdate(req.params.tournamentId, "queue:drawn", result);
  broadcastTournamentUpdate(req.params.tournamentId, "queue:changed");
  broadcastTournamentUpdate(req.params.tournamentId, "games:changed");
  res.json(result);
});
