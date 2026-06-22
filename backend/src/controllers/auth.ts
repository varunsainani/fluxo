import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { User as DbUser } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { conflict, unauthorized } from "../lib/errors";
import {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  refreshCookieOptions,
  clearRefreshCookieOptions,
  REFRESH_COOKIE,
} from "../lib/jwt";

const BCRYPT_ROUNDS = 10;

const DEMO_ACCOUNTS = {
  user: "demo@fluxo.app",
  admin: "admin@fluxo.app",
} as const;

function publicUser(u: DbUser) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, locale: u.locale };
}

async function setSession(res: Response, userId: string): Promise<void> {
  const raw = await issueRefreshToken(userId);
  res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions());
}

const registerSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
});

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = validate(registerSchema, req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw conflict("auth.emailTaken");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      locale: req.locale,
    },
  });

  await setSession(res, user.id);
  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  res.status(201).json({ user: publicUser(user), accessToken });
}

const loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = validate(loginSchema, req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw unauthorized("auth.invalidCredentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized("auth.invalidCredentials");

  await setSession(res, user.id);
  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  res.json({ user: publicUser(user), accessToken });
}

const demoSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export async function demo(req: Request, res: Response): Promise<void> {
  const { role } = validate(demoSchema, req.body);
  const email = DEMO_ACCOUNTS[role];

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("auth.demoUnavailable");

  await setSession(res, user.id);
  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  res.json({ user: publicUser(user), accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw: string | undefined = req.cookies?.[REFRESH_COOKIE];
  const record = await verifyRefreshToken(raw);
  if (!record) {
    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    throw unauthorized("auth.refreshInvalid");
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    await revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    throw unauthorized("auth.refreshInvalid");
  }

  const newRaw = await rotateRefreshToken(record.id, user.id);
  res.cookie(REFRESH_COOKIE, newRaw, refreshCookieOptions());

  const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw: string | undefined = req.cookies?.[REFRESH_COOKIE];
  await revokeRefreshToken(raw);
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw unauthorized("auth.tokenInvalid");
  res.json({ user: publicUser(user) });
}

const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  locale: z.enum(["en", "es", "pt"]).optional(),
});

export async function updateMe(req: Request, res: Response): Promise<void> {
  const { name, locale } = validate(updateMeSchema, req.body);

  const data: { name?: string; locale?: string } = {};
  if (name !== undefined) data.name = name.trim();
  if (locale !== undefined) data.locale = locale;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });
  res.json({ user: publicUser(user) });
}
