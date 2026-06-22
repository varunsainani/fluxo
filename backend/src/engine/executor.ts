import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveDeep, type ExprContext } from "./expr";
import { getHandler, TRIGGER_KINDS } from "./registry";
import { serializeExecution, type ExecutionDetail } from "./serialize";

type TriggerKind = "MANUAL" | "WEBHOOK" | "SCHEDULE";

interface FlowNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data: { name: string; config?: Record<string, unknown> };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const MAX_NODE_RUNS = 100;

export interface RunWorkflowOpts {
  workflowId: string;
  trigger: TriggerKind;
  input: unknown;
}

/**
 * Execute a workflow synchronously, persisting an Execution + NodeRuns, and return the
 * fully serialized ExecutionDetail.
 */
export async function runWorkflow(opts: RunWorkflowOpts): Promise<ExecutionDetail> {
  const { workflowId, trigger, input } = opts;

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }
  const userId = workflow.userId;

  const graph = normalizeGraph(workflow.graph);

  const startedAt = new Date();
  const $now = startedAt.toISOString();

  // Create the Execution (RUNNING).
  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      userId,
      status: "RUNNING",
      trigger,
      input: (input ?? {}) as object,
      startedAt,
    },
  });

  const ctx: ExprContext = {
    $json: input ?? {},
    $node: {},
    $now,
    $workflow: { id: workflow.id, name: workflow.name },
    $vars: {},
  };

  let execStatus: "SUCCESS" | "ERROR" = "SUCCESS";
  let execError: string | null = null;
  let order = 0;

  try {
    // Locate the entry trigger node.
    const entry = findEntryNode(graph, trigger);
    if (!entry) {
      throw new Error(`No matching trigger node for trigger=${trigger}`);
    }

    // Build adjacency for edge traversal.
    const nodesById = new Map<string, FlowNode>();
    for (const n of graph.nodes) nodesById.set(n.id, n);

    const visited = new Set<string>();
    let runs = 0;

    // Walk the graph: queue of { nodeId, input }.
    type Frame = { nodeId: string; nodeInput: unknown };
    const queue: Frame[] = [{ nodeId: entry.id, nodeInput: input ?? {} }];

    while (queue.length > 0) {
      const frame = queue.shift()!;
      const node = nodesById.get(frame.nodeId);
      if (!node) continue;

      // Cycle guard.
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      if (runs >= MAX_NODE_RUNS) {
        throw new Error(`Execution exceeded max node runs (${MAX_NODE_RUNS})`);
      }
      runs++;

      const handler = getHandler(node.type);
      if (!handler) {
        throw new Error(`Unknown node kind: ${node.type} (node "${node.data?.name ?? node.id}")`);
      }

      // ctx.$json reflects the input reaching THIS node.
      ctx.$json = frame.nodeInput;

      // Resolve config via §8 against the live ctx.
      const rawConfig = (node.data?.config ?? {}) as Record<string, unknown>;
      const resolvedConfig = resolveDeep(rawConfig, ctx) as Record<string, unknown>;

      const nodeStart = Date.now();
      let nodeStatus: "SUCCESS" | "ERROR" = "SUCCESS";
      let nodeOutput: unknown = undefined;
      let nodeError: string | null = null;
      let branch: "true" | "false" | undefined;

      try {
        const result = await handler({
          ctx,
          config: resolvedConfig,
          input: frame.nodeInput,
          userId,
          prisma,
        });
        nodeOutput = result.output;
        branch = result.branch;
      } catch (err) {
        nodeStatus = "ERROR";
        nodeError = err instanceof Error ? err.message : String(err);
      }

      const durationMs = Date.now() - nodeStart;

      // Persist the NodeRun.
      await prisma.nodeRun.create({
        data: {
          executionId: execution.id,
          nodeId: node.id,
          nodeKind: node.type,
          nodeName: node.data?.name ?? node.id,
          order: order++,
          status: nodeStatus,
          input: toJson(frame.nodeInput),
          output: toJson(nodeOutput),
          error: nodeError,
          durationMs,
        },
      });

      if (nodeStatus === "ERROR") {
        execStatus = "ERROR";
        execError = nodeError;
        break; // stop traversal on node error
      }

      // Record this node's output in the $node map (by NAME).
      const nodeName = node.data?.name ?? node.id;
      ctx.$node[nodeName] = { json: nodeOutput };

      // Determine outgoing edges. For action.if, only follow edges whose
      // sourceHandle matches the returned branch.
      const outgoing = graph.edges.filter((e) => e.source === node.id);
      const nextEdges =
        node.type === "action.if"
          ? outgoing.filter((e) => matchesBranch(e.sourceHandle, branch))
          : outgoing;

      for (const edge of nextEdges) {
        if (!visited.has(edge.target)) {
          queue.push({ nodeId: edge.target, nodeInput: nodeOutput });
        }
      }
    }
  } catch (err) {
    execStatus = "ERROR";
    if (!execError) execError = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status: execStatus,
      error: execError,
      finishedAt,
      durationMs,
    },
  });

  // Update workflow lastRunAt for liveliness.
  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { lastRunAt: finishedAt },
  }).catch(() => undefined);

  const full = await prisma.execution.findUnique({
    where: { id: execution.id },
    include: { nodeRuns: { orderBy: { order: "asc" } } },
  });
  if (!full) {
    throw new Error("Execution disappeared after run");
  }
  return serializeExecution(full);
}

function matchesBranch(sourceHandle: string | null | undefined, branch: "true" | "false" | undefined): boolean {
  const handle = (sourceHandle ?? "").toLowerCase();
  // Require an exact match: only edges whose handle equals the branch route.
  // Null/empty/unlabeled handles match neither branch.
  if (branch === "true") return handle === "true";
  if (branch === "false") return handle === "false";
  return false;
}

function findEntryNode(graph: Graph, trigger: TriggerKind): FlowNode | undefined {
  const triggerNodes = graph.nodes.filter((n) => TRIGGER_KINDS.has(n.type));

  if (trigger === "WEBHOOK") {
    return triggerNodes.find((n) => n.type === "trigger.webhook") ?? triggerNodes[0];
  }
  if (trigger === "SCHEDULE") {
    return triggerNodes.find((n) => n.type === "trigger.schedule") ?? triggerNodes[0];
  }
  // MANUAL: prefer trigger.manual, else any trigger node (manual run of any workflow).
  return (
    triggerNodes.find((n) => n.type === "trigger.manual") ??
    triggerNodes[0]
  );
}

function normalizeGraph(raw: unknown): Graph {
  if (raw && typeof raw === "object") {
    const g = raw as Record<string, unknown>;
    const nodes = Array.isArray(g.nodes) ? (g.nodes as FlowNode[]) : [];
    const edges = Array.isArray(g.edges) ? (g.edges as FlowEdge[]) : [];
    return { nodes, edges };
  }
  return { nodes: [], edges: [] };
}

/**
 * Prepare a value for a nullable Prisma Json column. `undefined`/`null` must be written
 * with `Prisma.JsonNull` (a literal JS null is rejected by the generated types).
 */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
