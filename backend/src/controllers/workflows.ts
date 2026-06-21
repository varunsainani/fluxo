import { Request, Response } from "express";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { validate, z } from "../lib/validate";
import { notFound } from "../lib/errors";
import { computeNextRunAt } from "../lib/cron";
import {
  asGraph,
  deriveTrigger,
  findScheduleNode,
  toExecSummary,
  toWorkflow,
  Graph,
} from "../lib/serializers";
import { runWorkflow, getExecutionDetail } from "../engine";

function newWebhookToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function seedGraph(): Graph {
  return {
    nodes: [
      {
        id: "n_" + crypto.randomBytes(3).toString("hex"),
        type: "trigger.manual",
        position: { x: 120, y: 120 },
        data: { name: "When clicked", config: {} },
      },
    ],
    edges: [],
  };
}

/**
 * Re-derive the schedule cache (cron/timezone/nextRunAt) from a trigger.schedule
 * node, only when the workflow is active. Otherwise null everything.
 */
function deriveScheduleCache(graph: Graph, active: boolean): {
  cron: string | null;
  timezone: string;
  nextRunAt: Date | null;
} {
  const node = findScheduleNode(graph);
  if (!active || !node) {
    return { cron: null, timezone: "UTC", nextRunAt: null };
  }
  const config = (node.data?.config ?? {}) as { cron?: unknown; timezone?: unknown };
  const cron = typeof config.cron === "string" && config.cron.trim() ? config.cron.trim() : null;
  const timezone = typeof config.timezone === "string" && config.timezone.trim() ? config.timezone.trim() : "UTC";
  if (!cron) {
    return { cron: null, timezone, nextRunAt: null };
  }
  const nextRunAt = computeNextRunAt(cron, timezone);
  return { cron, timezone, nextRunAt };
}

// ---- GET /workflows ----
export async function listWorkflows(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      executions: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  const items = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    active: w.active,
    trigger: deriveTrigger(asGraph(w.graph)),
    updatedAt: w.updatedAt.toISOString(),
    lastExecution: w.executions[0] ? toExecSummary(w.executions[0]) : null,
  }));

  res.json(items);
}

// ---- POST /workflows ----
const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export async function createWorkflow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { name, description } = validate(createSchema, req.body);

  const graph = seedGraph();
  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() ?? "",
      active: false,
      graph: graph as unknown as Prisma.InputJsonValue,
      webhookToken: newWebhookToken(),
      cron: null,
      timezone: "UTC",
      nextRunAt: null,
    },
  });

  res.status(201).json(toWorkflow(workflow));
}

// ---- GET /workflows/:id ----
export async function getWorkflow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!workflow) throw notFound("workflow.notFound");
  res.json(toWorkflow(workflow));
}

// ---- PATCH /workflows/:id ----
const graphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    name: z.string(),
    config: z.record(z.unknown()),
  }),
});

const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    graph: graphSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "error.validation" });

export async function updateWorkflow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = validate(patchSchema, req.body);

  const existing = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("workflow.notFound");

  const data: Prisma.WorkflowUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.graph !== undefined) data.graph = body.graph as unknown as Prisma.InputJsonValue;

  // The effective graph + active state after this patch.
  const nextGraph: Graph = body.graph !== undefined ? body.graph : asGraph(existing.graph);
  const nextActive: boolean = body.active !== undefined ? body.active : existing.active;

  if (body.active !== undefined) data.active = body.active;

  // Re-derive schedule cache whenever graph or active changes.
  if (body.graph !== undefined || body.active !== undefined) {
    const sched = deriveScheduleCache(nextGraph, nextActive);
    data.cron = sched.cron;
    data.timezone = sched.timezone;
    data.nextRunAt = sched.nextRunAt;
  }

  const updated = await prisma.workflow.update({
    where: { id: existing.id },
    data,
  });

  res.json(toWorkflow(updated));
}

// ---- DELETE /workflows/:id ----
export async function deleteWorkflow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const existing = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("workflow.notFound");

  await prisma.workflow.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}

// ---- POST /workflows/:id/run ----
const runSchema = z.object({
  input: z.unknown().optional(),
});

export async function runWorkflowController(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { input } = validate(runSchema, req.body ?? {});

  const existing = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) throw notFound("workflow.notFound");

  const execution = await runWorkflow({
    workflowId: existing.id,
    trigger: "MANUAL",
    input: input ?? undefined,
  });

  res.status(201).json(execution);
}

export { getExecutionDetail };
