// Round-trips the SPEC §5 `Graph` <-> React Flow nodes/edges.
//
// CONTRACT (must hold exactly):
//   - RF node `type` === logical `NodeKind` (e.g. "action.http")
//   - RF node `data` === { name: string, config: object } (no extra fields persisted)
//   - RF edge keeps `sourceHandle` (used by action.if: "true" | "false")
// We map back to `{ nodes:[{id,type,position,data:{name,config}}], edges:[{id,source,target,sourceHandle}] }`.

import type { Edge, Node } from "@xyflow/react";
import type { FlowEdge, FlowNode, Graph, NodeKind } from "@/lib/types";

/** The data shape carried on every React Flow node in the editor. */
export interface FluxoNodeData extends Record<string, unknown> {
  name: string;
  config: Record<string, unknown>;
  kind: NodeKind;
}

export type RFNode = Node<FluxoNodeData>;
export type RFEdge = Edge;

/** Backend Graph -> React Flow nodes. */
export function graphToNodes(graph: Graph): RFNode[] {
  return (graph.nodes ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
    data: {
      name: n.data?.name ?? "",
      config: (n.data?.config as Record<string, unknown>) ?? {},
      kind: n.type,
    },
  }));
}

/** Backend Graph -> React Flow edges. */
export function graphToEdges(graph: Graph): RFEdge[] {
  return (graph.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    type: "fluxo",
  }));
}

/** React Flow nodes/edges -> the exact backend Graph shape. */
export function toGraph(nodes: RFNode[], edges: RFEdge[]): Graph {
  const outNodes: FlowNode[] = nodes.map((n) => ({
    id: n.id,
    type: (n.type ?? n.data.kind) as NodeKind,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: {
      name: n.data.name ?? "",
      config: n.data.config ?? {},
    },
  }));

  const outEdges: FlowEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
  }));

  return { nodes: outNodes, edges: outEdges };
}

/** Stable-ish hash of the persisted graph shape — used for unsaved-change tracking. */
export function graphSignature(nodes: RFNode[], edges: RFEdge[]): string {
  return JSON.stringify(toGraph(nodes, edges));
}

let idCounter = 0;
/** Short, collision-resistant node id (matches the SPEC "n_ab12" flavor). */
export function newNodeId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `n_${rand}${idCounter.toString(36)}`;
}

export function newEdgeId(source: string, target: string, handle?: string | null): string {
  return `e_${source}_${target}${handle ? `_${handle}` : ""}_${Math.random().toString(36).slice(2, 5)}`;
}
