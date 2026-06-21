import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { toExecSummary, asGraph, deriveTrigger } from "../lib/serializers";

// ---- GET /admin/overview ----
export async function overview(_req: Request, res: Response): Promise<void> {
  const [users, workflows, activeWorkflows, executions, successCount, recent] = await Promise.all([
    prisma.user.count(),
    prisma.workflow.count(),
    prisma.workflow.count({ where: { active: true } }),
    prisma.execution.count(),
    prisma.execution.count({ where: { status: "SUCCESS" } }),
    prisma.execution.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: {
        user: { select: { name: true, email: true } },
        workflow: { select: { name: true } },
      },
    }),
  ]);

  const successRate = executions > 0 ? Math.round((successCount / executions) * 100) : 0;

  const recentExecutions = recent.map((e) => ({
    ...toExecSummary(e),
    user: { name: e.user.name, email: e.user.email },
    workflowName: e.workflow.name,
  }));

  res.json({
    stats: { users, workflows, activeWorkflows, executions, successRate },
    recentExecutions,
  });
}

// ---- GET /admin/users ----
export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { workflows: true, executions: true } },
    },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      workflowCount: u._count.workflows,
      executionCount: u._count.executions,
    }))
  );
}

// ---- GET /admin/workflows ----
export async function listAllWorkflows(_req: Request, res: Response): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
      executions: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  res.json(
    workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      active: w.active,
      trigger: deriveTrigger(asGraph(w.graph)),
      updatedAt: w.updatedAt.toISOString(),
      ownerEmail: w.user.email,
      ownerName: w.user.name,
      lastExecution: w.executions[0] ? toExecSummary(w.executions[0]) : null,
    }))
  );
}
