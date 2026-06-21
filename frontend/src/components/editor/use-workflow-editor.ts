"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { NodeKind, Workflow } from "@/lib/types";
import { catalogFor, defaultConfigFor, isTrigger } from "./node-catalog";
import {
  graphSignature,
  graphToEdges,
  graphToNodes,
  newEdgeId,
  newNodeId,
  type FluxoNodeData,
  type RFEdge,
  type RFNode,
} from "./serialize";

export interface WorkflowEditorState {
  nodes: RFNode[];
  edges: RFEdge[];
  selectedId: string | null;
  selectedNode: RFNode | null;
  dirty: boolean;
  name: string;
  setName: (name: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => boolean;
  selectNode: (id: string | null) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  updateNodeData: (id: string, patch: Partial<FluxoNodeData>) => void;
  updateConfig: (id: string, config: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  /** Replace status overlay on nodes (when viewing a run). */
  applyRunStatuses: (byNodeId: Record<string, FluxoNodeData["status"]>) => void;
  clearRunStatuses: () => void;
  /** Mark the current graph as the saved baseline. */
  markSaved: () => void;
  /** Default name for a new node of a kind (localized label passed in). */
}

/** A trigger may have at most one incoming-edge restriction; if-node uses handles. */
function validateConnection(conn: Connection, nodes: RFNode[], edges: RFEdge[]): boolean {
  const { source, target, sourceHandle } = conn;
  if (!source || !target) return false;
  if (source === target) return false; // no self-loop

  const targetNode = nodes.find((n) => n.id === target);
  if (!targetNode) return false;
  // A trigger never accepts an incoming edge.
  if (isTrigger(targetNode.type ?? targetNode.data.kind)) return false;

  // Single-input model: a node accepts only one incoming edge.
  if (edges.some((e) => e.target === target)) return false;

  // Each source handle may only fan out once (keeps the linear/branching model clean).
  if (
    edges.some(
      (e) => e.source === source && (e.sourceHandle ?? null) === (sourceHandle ?? null),
    )
  ) {
    return false;
  }

  // Prevent duplicate edges.
  if (edges.some((e) => e.source === source && e.target === target)) return false;

  return true;
}

export function useWorkflowEditor(initial: Workflow): WorkflowEditorState {
  const [nodes, setNodes] = useState<RFNode[]>(() => graphToNodes(initial.graph));
  const [edges, setEdges] = useState<RFEdge[]>(() => graphToEdges(initial.graph));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);

  // Baseline signature for dirty tracking.
  const baseline = useRef(graphSignature(graphToNodes(initial.graph), graphToEdges(initial.graph)));
  const baselineName = useRef(initial.name);
  const [sig, setSig] = useState(baseline.current);

  // Recompute the persisted signature whenever the graph changes.
  useEffect(() => {
    setSig(graphSignature(nodes, edges));
  }, [nodes, edges]);

  const dirty = sig !== baseline.current || name !== baselineName.current;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as RFNode[]);
    // Track selection from RF's own select changes.
    for (const c of changes) {
      if (c.type === "select") {
        if (c.selected) setSelectedId(c.id);
        else setSelectedId((prev) => (prev === c.id ? null : prev));
      } else if (c.type === "remove") {
        setSelectedId((prev) => (prev === c.id ? null : prev));
      }
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds) as RFEdge[]);
  }, []);

  const onConnect = useCallback(
    (conn: Connection): boolean => {
      let ok = false;
      setEdges((eds) => {
        if (!validateConnection(conn, nodes, eds)) return eds;
        ok = true;
        return [
          ...eds,
          {
            id: newEdgeId(conn.source!, conn.target!, conn.sourceHandle),
            source: conn.source!,
            target: conn.target!,
            sourceHandle: conn.sourceHandle ?? null,
            type: "fluxo",
          },
        ];
      });
      return ok;
    },
    [nodes],
  );

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
  }, []);

  const addNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }): string => {
      const entry = catalogFor(kind);
      const id = newNodeId();
      const node: RFNode = {
        id,
        type: kind,
        position,
        data: {
          name: "",
          config: defaultConfigFor(kind),
          kind,
        },
        selected: true,
      };
      // The localized default name is filled in by the caller via updateNodeData
      // (the hook is i18n-agnostic). We seed an empty name; the page sets it.
      void entry;
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), node]);
      setSelectedId(id);
      return id;
    },
    [],
  );

  const updateNodeData = useCallback((id: string, patch: Partial<FluxoNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }, []);

  const updateConfig = useCallback((id: string, config: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, config } } : n)),
    );
  }, []);

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const applyRunStatuses = useCallback((byNodeId: Record<string, FluxoNodeData["status"]>) => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: byNodeId[n.id] ?? "IDLE" } })),
    );
  }, []);

  const clearRunStatuses = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: undefined } })));
  }, []);

  const markSaved = useCallback(() => {
    const next = graphSignature(nodes, edges);
    baseline.current = next;
    baselineName.current = name;
    setSig(next);
  }, [nodes, edges, name]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  return {
    nodes,
    edges,
    selectedId,
    selectedNode,
    dirty,
    name,
    setName,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    updateNodeData,
    updateConfig,
    deleteNode,
    applyRunStatuses,
    clearRunStatuses,
    markSaved,
  };
}
