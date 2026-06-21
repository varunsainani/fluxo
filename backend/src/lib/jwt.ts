import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { prisma } from "./prisma";

export type Role = "USER" | "ADMIN";

export interface AccessTokenPayload {
  id: string;
  role: Role;
  email: string;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REFRESH_COOKIE = "fluxo_refresh";

// ---- Access tokens (JWT) ----

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessTokenPayload;
  return { id: decoded.id, role: decoded.role, email: decoded.email };
}

// ---- Refresh tokens (opaque, sha256-hashed in DB, rotated) ----

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Generate a fresh refresh token, persist its hash, and return the raw token
 * (to be set in the httpOnly cookie). 40 random bytes -> 80 hex chars.
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}

/**
 * Verify a raw refresh token. Returns the owning userId or null if invalid /
 * expired. Expired/unknown tokens are treated as invalid (and cleaned up).
 */
export async function verifyRefreshToken(raw: string | undefined): Promise<{ id: string; userId: string } | null> {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => undefined);
    return null;
  }
  return { id: record.id, userId: record.userId };
}

/**
 * Rotate a refresh token: delete the old record and issue a new one.
 * Returns the new raw token.
 */
export async function rotateRefreshToken(oldId: string, userId: string): Promise<string> {
  await prisma.refreshToken.delete({ where: { id: oldId } }).catch(() => undefined);
  return issueRefreshToken(userId);
}

/** Revoke a single refresh token by its raw value (used on logout). */
export async function revokeRefreshToken(raw: string | undefined): Promise<void> {
  if (!raw) return;
  const tokenHash = hashToken(raw);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProd,
    path: "/",
    maxAge: REFRESH_TTL_MS,
  };
}

export function clearRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProd,
    path: "/",
  };
}
