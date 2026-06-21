import { Request, Response } from "express";
import type { Notification as DbNotification } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { notFound } from "../lib/errors";

function toNotification(n: DbNotification) {
  return {
    id: n.id,
    channel: n.channel,
    title: n.title,
    body: n.body,
    meta: n.meta ?? null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

// ---- GET /notifications?unread= ----
const listQuerySchema = z.object({
  unread: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional(),
});

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { unread } = validate(listQuerySchema, req.query);
  const onlyUnread = unread === "true" || unread === "1";

  const notifications = await prisma.notification.findMany({
    where: { userId, ...(onlyUnread ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications.map(toNotification));
}

// ---- GET /notifications/unread-count ----
export async function unreadCount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const count = await prisma.notification.count({ where: { userId, read: false } });
  res.json({ count });
}

// ---- PATCH /notifications/:id ----
const patchSchema = z.object({
  read: z.boolean(),
});

export async function updateNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { read } = validate(patchSchema, req.body);

  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("notification.notFound");

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { read },
  });
  res.json(toNotification(updated));
}

// ---- POST /notifications/read-all ----
export async function readAll(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
}

// ---- DELETE /notifications/:id ----
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("notification.notFound");

  await prisma.notification.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}
