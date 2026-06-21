import type { Workflow as DbWorkflow, Execution as DbExecution } from "@prisma/client";

export type TriggerKind = "MANUAL" | "WEBHOOK" | "SCHEDULE";

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { name: string; config: Record<string, unknown> };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Safely coerce a stored Json graph into a Graph (defensive against bad data). */
export function asGraph(value: unknown): Graph {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const g = value as { nodes?: unknown; edges?: unknown };
    const nodes = Array.isArray(g.nodes) ? (g.nodes as FlowNode[]) : [];
    const edges = Array.isArray(g.edges) ? (g.edges as FlowEdge[]) : [];
    return { nodes, edges };
  }
  return { nodes: [], edges: [] };
}

/** Map a node kind to its trigger kind, or null if not a trigger node. */
function triggerKindOfNode(type: string): TriggerKind | null {
  switch (type) {
    case "trigger.manual":
      return "MANUAL";
    case "trigger.webhook":
      return "WEBHOOK";
    case "trigger.schedule":
      return "SCHEDULE";
    default:
      return null;
  }
}

/**
 * Derive the primary trigger kind shown in lists/badges. Prefers a non-manual
 * trigger (webhook/schedule) if present, else manual, else null.
 */
export function deriveTrigger(graph: Graph): TriggerKind | null {
  let manualSeen = false;
  for (const node of graph.nodes) {
    const kind = triggerKindOfNode(node.type);
    if (kind === "WEBHOOK" || kind === "SCHEDULE") return kind;
    if (kind === "MANUAL") manualSeen = true;
  }
  return manualSeen ? "MANUAL" : null;
}

/** Find the first trigger.schedule node in a graph, if any. */
export function findScheduleNode(graph: Graph): FlowNode | null {
  return graph.nodes.find((n) => n.type === "trigger.schedule") ?? null;
}

export interface ExecSummary {
  id: string;
  workflowId: string;
  status: string;
  trigger: TriggerKind;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export function toExecSummary(e: DbExecution): ExecSummary {
  return {
    id: e.id,
    workflowId: e.workflowId,
    status: e.status,
    trigger: e.trigger as TriggerKind,
    startedAt: e.startedAt.toISOString(),
    finishedAt: e.finishedAt ? e.finishedAt.toISOString() : null,
    durationMs: e.durationMs ?? null,
  };
}

/** Full Workflow shape matching frontend types.Workflow. */
export function toWorkflow(w: DbWorkflow) {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    active: w.active,
    graph: asGraph(w.graph),
    webhookToken: w.webhookToken,
    cron: w.cron ?? null,
    timezone: w.timezone,
    nextRunAt: w.nextRunAt ? w.nextRunAt.toISOString() : null,
    lastRunAt: w.lastRunAt ? w.lastRunAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}
