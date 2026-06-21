import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { conflict, notFound } from "../lib/errors";

// ---- GET /datastores ----
export async function listDatastores(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const datastores = await prisma.datastore.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });

  res.json(
    datastores.map((d) => ({
      id: d.id,
      name: d.name,
      rowCount: d._count.rows,
      createdAt: d.createdAt.toISOString(),
    }))
  );
}

// ---- POST /datastores ----
const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function createDatastore(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { name } = validate(createSchema, req.body);

  try {
    const datastore = await prisma.datastore.create({
      data: { userId, name: name.trim() },
    });
    res.status(201).json({
      id: datastore.id,
      name: datastore.name,
      rowCount: 0,
      createdAt: datastore.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("datastore.nameTaken");
    }
    throw err;
  }
}

// ---- GET /datastores/:id?limit=&offset= ----
const detailQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function getDatastore(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { limit, offset } = validate(detailQuerySchema, req.query);

  const datastore = await prisma.datastore.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!datastore) throw notFound("datastore.notFound");

  const take = limit ?? 100;
  const skip = offset ?? 0;

  const [rows, total] = await Promise.all([
    prisma.datastoreRow.findMany({
      where: { datastoreId: datastore.id },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.datastoreRow.count({ where: { datastoreId: datastore.id } }),
  ]);

  // columns = union of keys across the returned rows (order of first appearance).
  const columnSet = new Set<string>();
  for (const row of rows) {
    const data = row.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      for (const key of Object.keys(data as Record<string, unknown>)) columnSet.add(key);
    }
  }

  res.json({
    id: datastore.id,
    name: datastore.name,
    columns: Array.from(columnSet),
    rows: rows.map((r) => ({
      id: r.id,
      data: (r.data ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  });
}

// ---- DELETE /datastores/:id ----
export async function deleteDatastore(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const datastore = await prisma.datastore.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!datastore) throw notFound("datastore.notFound");

  await prisma.datastore.delete({ where: { id: datastore.id } });
  res.json({ ok: true });
}
