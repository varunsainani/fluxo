import { prisma } from "../lib/prisma";

/** JSON shapes mirroring frontend/src/lib/types.ts (Execution / NodeRun). */
export interface NodeRunJson {
  id: string;
  nodeId: string;
  nodeKind: string;
  nodeName: string;
  order: number;
  status: "RUNNING" | "SUCCESS" | "ERROR";
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number | null;
}

export interface ExecutionDetail {
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUCCESS" | "ERROR";
  trigger: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  input: unknown;
  error: string | null;
  nodeRuns: NodeRunJson[];
}

/** Load an execution with its node runs (ordered by `order`) as the serialized ExecutionDetail. */
export async function getExecutionDetail(executionId: string): Promise<ExecutionDetail | null> {
  const exec = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { nodeRuns: { orderBy: { order: "asc" } } },
  });
  if (!exec) return null;
  return serializeExecution(exec);
}

/** Serialize a Prisma execution (with included nodeRuns) into ExecutionDetail JSON. */
export function serializeExecution(exec: {
  id: string;
  workflowId: string;
  status: string;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  input: unknown;
  error: string | null;
  nodeRuns: {
    id: string;
    nodeId: string;
    nodeKind: string;
    nodeName: string;
    order: number;
    status: string;
    input: unknown;
    output: unknown;
    error: string | null;
    durationMs: number | null;
  }[];
}): ExecutionDetail {
  return {
    id: exec.id,
    workflowId: exec.workflowId,
    status: exec.status as ExecutionDetail["status"],
    trigger: exec.trigger as ExecutionDetail["trigger"],
    startedAt: exec.startedAt.toISOString(),
    finishedAt: exec.finishedAt ? exec.finishedAt.toISOString() : null,
    durationMs: exec.durationMs,
    input: exec.input,
    error: exec.error,
    nodeRuns: [...exec.nodeRuns]
      .sort((a, b) => a.order - b.order)
      .map((nr) => ({
        id: nr.id,
        nodeId: nr.nodeId,
        nodeKind: nr.nodeKind,
        nodeName: nr.nodeName,
        order: nr.order,
        status: nr.status as NodeRunJson["status"],
        input: nr.input,
        output: nr.output,
        error: nr.error,
        durationMs: nr.durationMs,
      })),
  };
}
