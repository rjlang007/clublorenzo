import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  refreshSubscriptionStatus,
  AuthedRequest,
} from "../lib/auth";
import { randomDefaultAvatarKey, defaultAvatarUrl } from "../lib/defaultAvatars";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in 15 minutes." },
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account registrations from this connection. Please try again later." },
});

const registerSchema = z.object({
  username: z.string().regex(USERNAME_RE, "3-20 characters: letters, numbers, underscore only."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

authRouter.post("/register", registrationLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { username, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      defaultAvatarKey: randomDefaultAvatarKey(),
      role: "PLAYER",
    },
  });

  const currentUser = await refreshSubscriptionStatus(user);
  const token = signSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json(publicUser({ ...user, subscriptionExpiresAt: currentUser.subscriptionExpiresAt, subscriptionStatus: currentUser.subscriptionStatus }));
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  if (user.isBlocked) {
    return res.status(403).json({ error: "This account is blocked. Contact a club administrator for help." });
  }

  const currentUser = await refreshSubscriptionStatus(user);
  const token = signSession(user.id);
  setSessionCookie(res, token);
  res.json(publicUser({ ...user, subscriptionExpiresAt: currentUser.subscriptionExpiresAt, subscriptionStatus: currentUser.subscriptionStatus }));
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", attachUser, async (req: AuthedRequest, res) => {
  if (!req.userId) return res.json(null);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.isBlocked) {
    clearSessionCookie(res);
    return res.json(null);
  }
  const currentUser = await refreshSubscriptionStatus(user);
  res.json(publicUser({ ...user, subscriptionExpiresAt: currentUser.subscriptionExpiresAt, subscriptionStatus: currentUser.subscriptionStatus }));
});

// Shared shape returned for "me" / own account. Public profile viewing
// (routes/users.ts) uses a stricter, more limited shape.
function publicUser(user: {
  id: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  defaultAvatarKey: string;
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "PLAYER";
  trialStartedAt?: Date | null;
  subscriptionExpiresAt?: Date | null;
  subscriptionStatus?: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    bio: user.bio ?? "",
    avatarUrl: user.avatarUrl ?? defaultAvatarUrl(user.defaultAvatarKey as any),
    role: user.role,
    trialStartedAt: user.trialStartedAt ?? null,
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    subscriptionStatus: user.subscriptionStatus ?? null,
    createdAt: user.createdAt,
  };
}
