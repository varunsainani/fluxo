import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type { Connection as DbConnection } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { conflict, notFound } from "../lib/errors";

interface HeaderPair {
  key: string;
  value: string;
}

function asHeaders(value: unknown): HeaderPair[] {
  if (Array.isArray(value)) {
    return value
      .filter((h): h is HeaderPair => !!h && typeof h === "object")
      .map((h) => ({ key: String((h as HeaderPair).key ?? ""), value: String((h as HeaderPair).value ?? "") }));
  }
  return [];
}

function toConnection(c: DbConnection) {
  return {
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl,
    headers: asHeaders(c.headers),
    createdAt: c.createdAt.toISOString(),
  };
}

const headersSchema = z.array(z.object({ key: z.string(), value: z.string() }));

// ---- GET /connections ----
export async function listConnections(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const connections = await prisma.connection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(connections.map(toConnection));
}

// ---- POST /connections ----
const createSchema = z.object({
  name: z.string().min(1).max(120),
  baseUrl: z.string().max(500).optional(),
  headers: headersSchema.optional(),
});

export async function createConnection(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { name, baseUrl, headers } = validate(createSchema, req.body);

  try {
    const connection = await prisma.connection.create({
      data: {
        userId,
        name: name.trim(),
        baseUrl: baseUrl?.trim() ?? "",
        headers: (headers ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
    res.status(201).json(toConnection(connection));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("connection.nameTaken");
    }
    throw err;
  }
}

// ---- PATCH /connections/:id ----
const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    baseUrl: z.string().max(500).optional(),
    headers: headersSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "error.validation" });

export async function updateConnection(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = validate(patchSchema, req.body);

  const existing = await prisma.connection.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("connection.notFound");

  const data: Prisma.ConnectionUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl.trim();
  if (body.headers !== undefined) data.headers = body.headers as unknown as Prisma.InputJsonValue;

  try {
    const updated = await prisma.connection.update({
      where: { id: existing.id },
      data,
    });
    res.json(toConnection(updated));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("connection.nameTaken");
    }
    throw err;
  }
}

// ---- DELETE /connections/:id ----
export async function deleteConnection(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const existing = await prisma.connection.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("connection.notFound");

  await prisma.connection.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}
