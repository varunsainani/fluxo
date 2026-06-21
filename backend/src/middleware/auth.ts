import { Request, Response, NextFunction } from "express";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";

/**
 * requireAuth: verify the Bearer access token and set
 * req.user = { id, role, email }. Throws UNAUTHORIZED on missing/invalid token.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("auth.tokenMissing");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw unauthorized("auth.tokenMissing");
  }
  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw unauthorized("auth.tokenInvalid");
  }
  next();
}

/** requireAdmin: requireAuth must run first; additionally checks role === ADMIN. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw unauthorized("auth.tokenMissing");
  }
  if (req.user.role !== "ADMIN") {
    throw forbidden("auth.adminOnly");
  }
  next();
}
