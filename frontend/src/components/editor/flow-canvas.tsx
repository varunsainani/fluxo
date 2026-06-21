"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type OnConnect,
  useReactFlow,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import type { NodeKind } from "@/lib/types";
import { FluxoNode } from "./fluxo-node";
import { FluxoEdge } from "./fluxo-edge";
import { DND_MIME } from "./node-palette";
import type { WorkflowEditorState } from "./use-workflow-editor";

const nodeTypes: NodeTypes = {
  "trigger.manual": FluxoNode,
  "trigger.webhook": FluxoNode,
  "trigger.schedule": FluxoNode,
  "action.http": FluxoNode,
  "action.setFields": FluxoNode,
  "action.if": FluxoNode,
  "action.appendRow": FluxoNode,
  "action.notify": FluxoNode,
  "action.delay": FluxoNode,
  "action.code": FluxoNode,
};

const edgeTypes: EdgeTypes = { fluxo: FluxoEdge };

export function FlowCanvas({
  editor,
  defaultName,
  onInvalidConnection,
}: {
  editor: WorkflowEditorState;
  /** Localized default node name for a freshly added kind. */
  defaultName: (kind: NodeKind) => string;
  onInvalidConnection?: () => void;
}) {
  const t = useTranslations("editor");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleConnect: OnConnect = useCallback(
    (conn) => {
      const ok = editor.onConnect(conn);
      if (!ok) onInvalidConnection?.();
    },
    [editor, onInvalidConnection],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const placeNode = useCallback(
    (kind: NodeKind, clientX: number, clientY: number) => {
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = editor.addNode(kind, position);
      editor.updateNodeData(id, { name: defaultName(kind) });
    },
    [screenToFlowPosition, editor, defaultName],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DND_MIME) as NodeKind;
      if (!kind) return;
      placeNode(kind, e.clientX, e.clientY);
    },
    [placeNode],
  );

  const fitView = useMemo(() => editor.nodes.length > 0, [editor.nodes.length]);

  return (
    <div ref={wrapperRef} className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={editor.nodes}
        edges={editor.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={editor.onNodesChange}
        onEdgesChange={editor.onEdgesChange}
        onConnect={handleConnect}
        onPaneClick={() => editor.selectNode(null)}
        defaultEdgeOptions={{ type: "fluxo" }}
        fitView={fitView}
        fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
        minZoom={0.25}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-grid"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--grid-dot)" />
        <Controls showInteractive={false} />
        {editor.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/70 px-6 py-5 text-center backdrop-blur-sm">
              <p className="font-mono text-sm text-muted">{t("emptyCanvas")}</p>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
