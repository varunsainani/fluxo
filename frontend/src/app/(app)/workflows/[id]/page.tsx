"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Workflow as WorkflowIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { NodeKind, Workflow } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

import { useWorkflowEditor } from "@/components/editor/use-workflow-editor";
import { FlowCanvas } from "@/components/editor/flow-canvas";
import { NodePalette } from "@/components/editor/node-palette";
import { ConfigPanel } from "@/components/editor/config-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import type { FluxoNodeData } from "@/components/editor/serialize";

export default function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toApiError = useApiError();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const wf = await api.get<Workflow>(`/workflows/${id}`);
        if (!cancelled) setWorkflow(wf);
      } catch (e) {
        const ae = e as { status?: number };
        if (!cancelled) {
          if (ae.status === 404) setNotFound(true);
          else toApiError(e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toApiError]);

  if (loading) {
    return (
      <FullBleed>
        <div className="flex h-full items-center justify-center bg-grid">
          <Spinner size={26} className="text-[var(--primary)]" />
        </div>
      </FullBleed>
    );
  }

  if (notFound || !workflow) {
    return (
      <FullBleed>
        <div className="flex h-full items-center justify-center bg-grid p-6">
          <NotFoundCard />
        </div>
      </FullBleed>
    );
  }

  return (
    <FullBleed>
      <ReactFlowProvider>
        <Editor workflow={workflow} onWorkflow={setWorkflow} />
      </ReactFlowProvider>
    </FullBleed>
  );
}

/**
 * Full-bleed region that fills the app content area below the topbar (h-14)
 * and to the right of the desktop sidebar (w-60). Uses fixed positioning so it
 * is independent of the shell's max-width / padding. z-20 sits below the topbar
 * (z-30) so its menus stay usable.
 */
function FullBleed({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-20 lg:left-60">{children}</div>
  );
}

function NotFoundCard() {
  const t = useTranslations("editor");
  return (
    <EmptyState
      icon={WorkflowIcon}
      title={t("workflowNotFound")}
      action={
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
        >
          <ArrowLeft size={14} />
          {t("backToList")}
        </Link>
      }
    />
  );
}

function Editor({
  workflow,
  onWorkflow,
}: {
  workflow: Workflow;
  onWorkflow: (wf: Workflow) => void;
}) {
  const t = useTranslations("editor");
  const tKinds = useTranslations("nodeKinds");
  const toast = useToast();

  const editor = useWorkflowEditor(workflow);
  const [panelOpen, setPanelOpen] = useState(true);

  const defaultName = useCallback((kind: NodeKind) => tKinds(kind), [tKinds]);

  // Open the config panel whenever a node is selected.
  useEffect(() => {
    if (editor.selectedId) setPanelOpen(true);
  }, [editor.selectedId]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editor.dirty]);

  const hasTrigger = editor.nodes.some((n) => (n.type ?? n.data.kind).startsWith("trigger."));

  const handleAddFromPalette = useCallback(
    (kind: NodeKind) => {
      // Click-to-add: place near the upper-left of the current viewport-ish area.
      // The canvas converts via flow coords; we use a sensible default offset.
      const offsetX = 80 + (editor.nodes.length % 4) * 40;
      const offsetY = 80 + Math.floor(editor.nodes.length / 4) * 30;
      const newId = editor.addNode(kind, { x: offsetX, y: offsetY });
      editor.updateNodeData(newId, { name: tKinds(kind) });
      setPanelOpen(true);
    },
    [editor, tKinds],
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <EditorToolbar
        workflow={workflow}
        editor={editor}
        onSaved={onWorkflow}
        onActiveChange={(active) => onWorkflow({ ...workflow, active })}
        onRunStatuses={(byNode: Record<string, FluxoNodeData["status"]>) =>
          editor.applyRunStatuses(byNode)
        }
      />

      {/* mobile fallback: stacked, usable but advises desktop for full editing */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        <MobileEditor
          editor={editor}
          workflow={workflow}
          hasTrigger={hasTrigger}
          onAdd={handleAddFromPalette}
        />
      </div>

      {/* desktop: palette | canvas | config */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-soft)]">
          <NodePalette onAdd={handleAddFromPalette} hasTrigger={hasTrigger} />
        </aside>

        <div className="relative min-w-0 flex-1">
          <FlowCanvas
            editor={editor}
            defaultName={defaultName}
            onInvalidConnection={() => toast.error(t("invalidConnection"))}
          />
        </div>

        <aside
          className={cn(
            "shrink-0 overflow-hidden border-l border-[var(--border)] bg-[var(--bg-soft)] transition-[width]",
            panelOpen && editor.selectedNode ? "w-80" : "w-0",
          )}
        >
          {editor.selectedNode && (
            <ConfigPanel
              node={editor.selectedNode}
              workflow={workflow}
              onChangeName={(name) => editor.updateNodeData(editor.selectedNode!.id, { name })}
              onChangeConfig={(config) => editor.updateConfig(editor.selectedNode!.id, config)}
              onDelete={() => {
                editor.deleteNode(editor.selectedNode!.id);
                toast.success(t("nodeDeleted"));
              }}
              onClose={() => editor.selectNode(null)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

/** Stacked editor for narrow screens: palette on top, canvas below, config as a sheet. */
function MobileEditor({
  editor,
  workflow,
  hasTrigger,
  onAdd,
}: {
  editor: ReturnType<typeof useWorkflowEditor>;
  workflow: Workflow;
  hasTrigger: boolean;
  onAdd: (kind: NodeKind) => void;
}) {
  const t = useTranslations("editor");
  const toast = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2">
        <p className="text-[11px] text-faint">{t("mobileHint")}</p>
        <button
          onClick={() => setPaletteOpen((o) => !o)}
          className="rounded-md border border-[var(--border)] px-2.5 py-1 font-mono text-[11px] text-fg"
        >
          {t("addNode")}
        </button>
      </div>

      {paletteOpen && (
        <div className="absolute inset-x-0 top-[37px] z-20 max-h-[55%] overflow-y-auto border-b border-[var(--border)] bg-[var(--bg-soft)] shadow-xl">
          <NodePalette
            onAdd={(k) => {
              onAdd(k);
              setPaletteOpen(false);
            }}
            hasTrigger={hasTrigger}
          />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <FlowCanvas
          editor={editor}
          defaultName={(k) => k}
          onInvalidConnection={() => toast.error(t("invalidConnection"))}
        />
      </div>

      {/* config sheet from the bottom */}
      {editor.selectedNode && (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-hidden rounded-t-xl border-t border-[var(--border)] bg-[var(--bg-soft)] shadow-2xl">
          <div className="h-full overflow-y-auto">
            <ConfigPanel
              node={editor.selectedNode}
              workflow={workflow}
              onChangeName={(name) => editor.updateNodeData(editor.selectedNode!.id, { name })}
              onChangeConfig={(config) => editor.updateConfig(editor.selectedNode!.id, config)}
              onDelete={() => {
                editor.deleteNode(editor.selectedNode!.id);
                toast.success(t("nodeDeleted"));
              }}
              onClose={() => editor.selectNode(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
