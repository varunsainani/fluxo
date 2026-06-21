import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { notFound } from "../lib/errors";
import { toExecSummary } from "../lib/serializers";
import { getExecutionDetail } from "../engine";

const listQuerySchema = z.object({
  workflowId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// ---- GET /executions?workflowId=&limit= ----
export async function listExecutions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { workflowId, limit } = validate(listQuerySchema, req.query);

  const executions = await prisma.execution.findMany({
    where: { userId, ...(workflowId ? { workflowId } : {}) },
    orderBy: { startedAt: "desc" },
    take: limit ?? 50,
  });

  res.json(executions.map(toExecSummary));
}

// ---- GET /executions/:id ----
export async function getExecution(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  // Scope to owner before exposing engine detail.
  const owned = await prisma.execution.findFirst({
    where: { id: req.params.id, userId },
    select: { id: true },
  });
  if (!owned) throw notFound("execution.notFound");

  const detail = await getExecutionDetail(req.params.id);
  if (!detail) throw notFound("execution.notFound");

  res.json(detail);
}
