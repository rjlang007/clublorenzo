import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { attachUser, hashPassword, requireAuth, requireAdmin, requireSuperAdmin, AuthedRequest } from "../lib/auth";
import { randomDefaultAvatarKey, defaultAvatarUrl } from "../lib/defaultAvatars";
import { TOURNAMENT_PHOTO_DIR, uploadPaymentProof } from "../lib/uploads";

export const accountsRouter = Router();
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const createAccountSchema = z.object({
  username: z.string().regex(USERNAME_RE),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "STAFF"]),
});

accountsRouter.get("/", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (!actor || !["SUPERADMIN", "ADMIN"].includes(actor.role)) {
    return res.status(403).json({ error: "Administrator access is required to manage club roles." });
  }
  const users = await prisma.user.findMany({
    where: actor.role === "SUPERADMIN" ? { role: { in: ["ADMIN", "STAFF", "PLAYER"] } } : { role: { in: ["STAFF", "PLAYER"] } },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, role: true, createdAt: true, isBlocked: true },
  });
  res.json(users);
});

accountsRouter.post("/", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (!actor || !["SUPERADMIN", "ADMIN"].includes(actor.role)) {
    return res.status(403).json({ error: "Administrator access is required to create club roles." });
  }
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { username, password, role } = parsed.data;
  if (role === "ADMIN" && actor.role !== "SUPERADMIN") {
    return res.status(403).json({ error: "Only the platform superadmin can create the club admin account." });
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "That username is already taken." });

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        role,
        defaultAvatarKey: randomDefaultAvatarKey(),
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002" && role === "ADMIN") {
      return res.status(409).json({ error: "A club admin already exists. Only one admin account is allowed." });
    }
    throw error;
  }
  res.status(201).json({
    id: user.id,
    username: user.username,
    role: user.role,
    avatarUrl: defaultAvatarUrl(user.defaultAvatarKey as any),
    createdAt: user.createdAt,
    trialStartedAt: user.trialStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    subscriptionStatus: user.subscriptionStatus,
  });
});

accountsRouter.post("/become-organizer", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  res.status(403).json({ error: "Club roles are assigned by the club administrator." });
});

const roleUpdateSchema = z.object({ role: z.enum(["ADMIN", "STAFF", "PLAYER"]) });
accountsRouter.patch("/:id/role", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (!actor || !["SUPERADMIN", "ADMIN"].includes(actor.role)) {
    return res.status(403).json({ error: "Administrator access is required to change club roles." });
  }
  const parsed = roleUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true, role: true, isBlocked: true } });
  if (!target || target.role === "SUPERADMIN") return res.status(404).json({ error: "Managed account not found." });
  if (parsed.data.role === "ADMIN" && target.isBlocked) {
    return res.status(409).json({ error: "Unblock this account before assigning the club admin role." });
  }
  if (actor.role === "ADMIN" && (target.role === "ADMIN" || parsed.data.role === "ADMIN")) {
    return res.status(403).json({ error: "Only the platform superadmin can change the single club admin role." });
  }
  try {
    const updated = parsed.data.role === "ADMIN"
      ? await prisma.$transaction(async (tx) => {
        const currentAdmin = await tx.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
        if (currentAdmin && currentAdmin.id !== target.id) {
          await tx.user.update({ where: { id: currentAdmin.id }, data: { role: "STAFF" } });
        }
        return tx.user.update({ where: { id: target.id }, data: { role: "ADMIN" }, select: { id: true, username: true, role: true, createdAt: true } });
      })
      : await prisma.$transaction(async (tx) => {
        if (target.role === "ADMIN") {
          const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
          if (adminCount <= 1) return null;
        }
        return tx.user.update({ where: { id: target.id }, data: { role: parsed.data.role }, select: { id: true, username: true, role: true, createdAt: true } });
      });
    if (!updated) return res.status(409).json({ error: "Transfer the admin role to another account before changing the only club admin." });
    res.json(updated);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002" && parsed.data.role === "ADMIN") {
      return res.status(409).json({ error: "A club admin already exists. Only one admin account is allowed." });
    }
    throw error;
  }
});

const accountStatusSchema = z.object({ isBlocked: z.boolean() });
accountsRouter.patch("/:id/status", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const parsed = accountStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const result = await prisma.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: req.userId }, select: { id: true, role: true } });
    if (!actor || !["SUPERADMIN", "ADMIN"].includes(actor.role)) return { kind: "forbidden" as const };

    const target = await tx.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, role: true },
    });
    if (!target || target.role === "SUPERADMIN") return { kind: "missing" as const };
    if (target.id === actor.id) return { kind: "self" as const };
    if (actor.role === "ADMIN" && target.role === "ADMIN") return { kind: "forbidden" as const };

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { isBlocked: parsed.data.isBlocked },
      select: { id: true, username: true, role: true, isBlocked: true },
    });
    return { kind: "updated" as const, updated };
  });

  if (result.kind === "forbidden") {
    return res.status(403).json({ error: "You do not have permission to change this account's access." });
  }
  if (result.kind === "missing") return res.status(404).json({ error: "Managed account not found." });
  if (result.kind === "self") return res.status(400).json({ error: "You cannot block your own account." });
  return res.json(result.updated);
});

accountsRouter.post("/subscription-payment-proof", attachUser, requireAuth, uploadPaymentProof.single("proof"), async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true, subscriptionPaymentProofStoredFile: true } });
  if (!user || user.role !== "ADMIN") return res.status(403).json({ error: "Only organizer accounts can submit renewal proof." });
  if (!req.file) return res.status(400).json({ error: "Payment proof image is required." });
  const setting = await prisma.platformSetting.findUnique({ where: { id: "platform" }, select: { monthlyPriceCents: true } });
  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      subscriptionPaymentProofStoredFile: req.file.filename,
      subscriptionPaymentSubmittedAt: new Date(),
      subscriptionPaymentStatus: "PENDING",
      subscriptionPaymentAmountCents: setting?.monthlyPriceCents ?? 0,
    },
  });
  if (user.subscriptionPaymentProofStoredFile) await unlinkPaymentProof(user.subscriptionPaymentProofStoredFile);
  res.json({ paymentStatus: updated.subscriptionPaymentStatus, paymentSubmittedAt: updated.subscriptionPaymentSubmittedAt });
});

accountsRouter.get("/:id/subscription-payment-proof", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const [account, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, subscriptionPaymentProofStoredFile: true } }),
    prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } }),
  ]);
  if (!account?.subscriptionPaymentProofStoredFile) return res.status(404).json({ error: "Subscription payment proof not found." });
  if (account.id !== req.userId && viewer?.role !== "SUPERADMIN") return res.status(403).json({ error: "You cannot view this payment proof." });
  return res.sendFile(path.join(path.dirname(TOURNAMENT_PHOTO_DIR), "payments", account.subscriptionPaymentProofStoredFile));
});

accountsRouter.patch("/:id/approve-payment", attachUser, requireSuperAdmin, async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.params.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== "ADMIN") return { kind: "missing" as const };
    if (user.subscriptionPaymentStatus !== "PENDING" || !user.subscriptionPaymentProofStoredFile || !user.subscriptionPaymentSubmittedAt) {
      return { kind: "not-pending" as const };
    }
    const now = new Date();
    const base = user.subscriptionExpiresAt && user.subscriptionExpiresAt > now ? user.subscriptionExpiresAt : now;
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { subscriptionExpiresAt: new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000), subscriptionStatus: "ACTIVE", subscriptionPaymentStatus: "APPROVED" },
    });
    const amountCents = user.subscriptionPaymentAmountCents ?? 0;
    if (amountCents > 0 && user.subscriptionPaymentSubmittedAt) {
      await tx.paymentLedgerEntry.createMany({
        data: [{
          idempotencyKey: `subscription:${user.id}:${user.subscriptionPaymentSubmittedAt.toISOString()}`,
          type: "SUBSCRIPTION_PAYMENT",
          amountCents,
          description: `Verified organizer subscription renewal for @${user.username}`,
          userId: user.id,
        }],
        skipDuplicates: true,
      });
    }
    return { kind: "approved" as const, updated };
  });
  if (result.kind === "missing") return res.status(404).json({ error: "Administrator account not found." });
  if (result.kind === "not-pending") return res.status(409).json({ error: "A pending renewal payment with uploaded proof is required before approval." });
  const updated = result.updated;
  res.json({ id: updated.id, username: updated.username, subscriptionExpiresAt: updated.subscriptionExpiresAt, subscriptionStatus: updated.subscriptionStatus });
});

accountsRouter.patch("/:id/reject-payment", attachUser, requireSuperAdmin, async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.params.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: req.params.id, role: "ADMIN" } });
    if (!user) return { kind: "missing" as const };
    if (user.subscriptionPaymentStatus !== "PENDING" || !user.subscriptionPaymentProofStoredFile || !user.subscriptionPaymentSubmittedAt) {
      return { kind: "not-pending" as const };
    }
    const updated = await tx.user.update({ where: { id: user.id }, data: { subscriptionPaymentStatus: "REJECTED" } });
    return { kind: "rejected" as const, updated };
  });
  if (result.kind === "missing") return res.status(404).json({ error: "Organizer account not found." });
  if (result.kind === "not-pending") return res.status(409).json({ error: "There is no pending renewal payment to reject." });
  const updated = result.updated;
  res.json({ id: updated.id, subscriptionPaymentStatus: updated.subscriptionPaymentStatus });
});

async function unlinkPaymentProof(storedFile: string) {
  try {
    await fs.unlink(path.join(path.dirname(TOURNAMENT_PHOTO_DIR), "payments", storedFile));
  } catch (err: any) {
    if (err?.code !== "ENOENT") console.error("Failed to replace subscription payment proof:", err);
  }
}