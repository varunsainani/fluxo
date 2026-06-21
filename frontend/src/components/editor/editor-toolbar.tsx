"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Play, Save } from "lucide-react";
import { api } from "@/lib/api";
import type { Execution, Workflow } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { toGraph, type FluxoNodeData } from "./serialize";
import type { WorkflowEditorState } from "./use-workflow-editor";

export function EditorToolbar({
  workflow,
  editor,
  onSaved,
  onActiveChange,
  onRunStatuses,
  menuButton,
}: {
  workflow: Workflow;
  editor: WorkflowEditorState;
  onSaved: (wf: Workflow) => void;
  onActiveChange: (active: boolean) => void;
  /** Paint per-node statuses on the canvas after a run. */
  onRunStatuses: (byNodeId: Record<string, FluxoNodeData["status"]>) => void;
  menuButton?: React.ReactNode;
}) {
  const t = useTranslations("editor");
  const router = useRouter();
  const toApiError = useApiError();
  const toast = useToast();

  const [active, setActive] = useState(workflow.active);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const graph = toGraph(editor.nodes, editor.edges);
      const updated = await api.patch<Workflow>(`/workflows/${workflow.id}`, {
        name: editor.name.trim() || workflow.name,
        graph,
      });
      editor.markSaved();
      onSaved(updated);
      toast.success(t("saved"));
      return true;
    } catch (e) {
      toast.error(toApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (next: boolean) => {
    // Persisting active also re-derives the schedule cache on the server; if there
    // are unsaved graph edits, save them first so the cache is consistent.
    setTogglingActive(true);
    setActive(next);
    try {
      if (editor.dirty) {
        const ok = await save();
        if (!ok) {
          setActive(!next);
          return;
        }
      }
      const updated = await api.patch<Workflow>(`/workflows/${workflow.id}`, { active: next });
      onActiveChange(next);
      onSaved(updated);
      toast.success(next ? t("activatedToast") : t("deactivatedToast"));
    } catch (e) {
      setActive(!next);
      toast.error(toApiError(e));
    } finally {
      setTogglingActive(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      // Always persist the latest graph before running so the run reflects edits.
      if (editor.dirty) {
        const ok = await save();
        if (!ok) return;
      }
      toast.info(t("runStarted"));
      const exec = await api.post<Execution>(`/workflows/${workflow.id}/run`, {});
      // Paint node statuses on the canvas as immediate feedback.
      const byNode: Record<string, FluxoNodeData["status"]> = {};
      for (const nr of exec.nodeRuns) byNode[nr.nodeId] = nr.status;
      onRunStatuses(byNode);
      if (exec.status === "SUCCESS") toast.success(t("runFinishedSuccess"));
      else if (exec.status === "ERROR") toast.error(t("runFinishedError"));
      router.push(`/executions/${exec.id}`);
    } catch (e) {
      toast.error(toApiError(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-soft)] px-3 sm:px-4">
      {menuButton}
      <Link
        href="/workflows"
        aria-label={t("backToList")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-[var(--surface-hover)] hover:text-fg"
      >
        <ArrowLeft size={17} />
      </Link>

      {/* editable name */}
      <input
        value={editor.name}
        onChange={(e) => editor.setName(e.target.value)}
        aria-label={t("rename")}
        spellCheck={false}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-mono text-sm font-semibold text-fg outline-none transition-colors hover:border-[var(--border)] focus:border-[var(--primary)] focus:bg-[var(--bg-soft)]"
        placeholder={workflow.name}
      />

      {/* dirty indicator */}
      <Badge
        variant={editor.dirty ? "brand" : "idle"}
        dot
        className="hidden shrink-0 sm:inline-flex"
      >
        {editor.dirty ? t("unsaved") : t("saved")}
      </Badge>

      {/* active toggle */}
      <label
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1",
          togglingActive && "opacity-70",
        )}
      >
        <span className="hidden font-mono text-[11px] uppercase tracking-wide text-muted sm:inline">
          {t("activate")}
        </span>
        <Switch checked={active} onChange={toggleActive} disabled={togglingActive} label={t("activate")} />
      </label>

      {/* save */}
      <Button
        variant="outline"
        size="sm"
        onClick={save}
        loading={saving}
        disabled={!editor.dirty || saving}
        className="shrink-0"
      >
        {editor.dirty ? <Save size={15} /> : <Check size={15} />}
        <span className="hidden sm:inline">{t("save")}</span>
      </Button>

      {/* run now */}
      <Button size="sm" onClick={run} loading={running} className="shrink-0">
        <Play size={15} />
        <span className="hidden sm:inline">{running ? t("running") : t("run")}</span>
      </Button>
    </div>
  );
}
