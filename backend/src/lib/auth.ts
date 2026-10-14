import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "session_token";
let developmentSecret: string | undefined;

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  if (configuredSecret) {
    if (configuredSecret.length < 32 || configuredSecret === "change_this_secret") {
      throw new Error("JWT_SECRET must be a unique secret with at least 32 characters.");
    }
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured before starting the production server.");
  }

  developmentSecret ??= randomBytes(48).toString("base64url");
  return developmentSecret;
}

export function validateAuthConfiguration(): void {
  getJwtSecret();
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
    console.warn("JWT_SECRET is not configured; using a temporary development-only secret. Sessions will expire when this process restarts.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function refreshSubscriptionStatus(user: {
  id: string;
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "PLAYER";
  subscriptionExpiresAt: Date | null;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | null;
}) {
  if (user.role !== "ADMIN") return user;
  const { prisma } = await import("./prisma.js");
  const setting = await prisma.platformSetting.findUnique({ where: { id: "platform" }, select: { monthlyPriceCents: true } });
  const monthlyPriceCents = setting?.monthlyPriceCents ?? Number(process.env.DEFAULT_MONTHLY_PRICE_CENTS || 0);
  if (monthlyPriceCents <= 0) {
    if (user.subscriptionStatus === "SUSPENDED" || user.subscriptionStatus === "EXPIRED") {
      return prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: "ACTIVE" } });
    }
    return user;
  }
  if (!user.subscriptionExpiresAt) return user;
  if (user.subscriptionExpiresAt > new Date()) {
    if (user.subscriptionStatus === "EXPIRED" || user.subscriptionStatus === "SUSPENDED") {
      return prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: "ACTIVE" } });
    }
    return user;
  }
  if (user.subscriptionStatus !== "SUSPENDED") {
    return prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: "SUSPENDED" } });
  }
  return user;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { algorithm: "HS256", expiresIn: "30m" });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: "SUPERADMIN" | "ADMIN" | "STAFF" | "PLAYER";
}

export async function canManageTournament(req: AuthedRequest, tournamentId: string) {
  if (!req.userId) return false;
  const { prisma } = await import("./prisma.js");
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, isBlocked: true } });
  if (!user || user.isBlocked || !["SUPERADMIN", "ADMIN", "STAFF"].includes(user.role)) return false;
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
  return !!tournament;
}

export async function canManageClubContent(req: AuthedRequest) {
  if (!req.userId) return false;
  const { prisma } = await import("./prisma.js");
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, isBlocked: true } });
  return !!user && !user.isBlocked && ["SUPERADMIN", "ADMIN", "STAFF"].includes(user.role);
}

// Attaches req.userId if a valid session cookie is present, but does not
// reject the request. Use `requireAuth` below to enforce login.
export function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
      if (typeof payload === "object" && typeof payload.sub === "string") {
        req.userId = payload.sub;
      }
    } catch {
      // ignore invalid/expired token - request proceeds unauthenticated
    }
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Not signed in." });
  }
  import("./prisma.js").then(async ({ prisma }) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, isBlocked: true } });
    if (!user) return res.status(401).json({ error: "Account not found." });
    if (user.isBlocked) {
      clearSessionCookie(res);
      return res.status(403).json({ error: "This account is blocked. Contact a club administrator for help." });
    }
    next();
  }).catch(next);
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Not signed in." });
  }
  const { prisma } = await import("./prisma.js");
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, isBlocked: true } });
  if (!user || user.isBlocked || !["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  req.userRole = user.role;
  next();
}

export async function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Not signed in." });
  const { prisma } = await import("./prisma.js");
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, isBlocked: true } });
  if (!user || user.isBlocked || user.role !== "SUPERADMIN") {
    return res.status(403).json({ error: "Platform owner access is required." });
  }
  req.userRole = user.role;
  next();
}
