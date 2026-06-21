"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { api } from "@/lib/api";
import type { Execution, NodeRun, WorkflowListItem } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { nodeIcon } from "@/lib/node-meta";
import { Card } from "@/components/ui/card";
import { StatusBadge, Badge, execStatusVariant } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

const railColor: Record<string, string> = {
  RUNNING: "bg-[color:var(--signal)]",
  SUCCESS: "bg-[color:var(--ok)]",
  ERROR: "bg-[color:var(--err)]",
};

export default function ExecutionInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("executions");
  const tTrig = useTranslations("triggers");
  const tStatus = useTranslations("status");
  const tNodeKind = useTranslations("nodeKinds");
  const locale = useLocale();
  const toApiError = useApiError();

  const [exec, setExec] = useState<Execution | null>(null);
  const [wfName, setWfName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const ex = await api.get<Execution>(`/executions/${id}`);
      setExec(ex);
      // open the first errored step (or the first step) by default
      const firstError = ex.nodeRuns.find((r) => r.status === "ERROR");
      const target = firstError ?? ex.nodeRuns[0];
      if (target) setOpen({ [target.id]: true });
      // resolve workflow name
      try {
        const wfs = await api.get<WorkflowListItem[]>("/workflows");
        setWfName(wfs.find((w) => w.id === ex.workflowId)?.name ?? "");
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      const ae = e as { status?: number };
      if (ae.status === 404) setNotFound(true);
      else toApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id, toApiError]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (notFound || !exec) {
    return (
      <EmptyState
        icon={Clock}
        title={t("notFound")}
        action={
          <Link
            href="/executions"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            <ArrowLeft size={14} />
            {t("backToList")}
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Link
        href="/executions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} />
        {t("backToList")}
      </Link>

      {/* header */}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-mono text-lg font-semibold text-fg">
                {wfName || t("execution")}
              </h1>
              <StatusBadge status={exec.status} label={tStatus(exec.status)} />
            </div>
            <p className="mt-1 font-mono text-xs text-faint">{exec.id}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label={t("trigger")} value={tTrig(exec.trigger)} />
          <Meta label={t("duration")} value={formatDuration(exec.durationMs, locale)} />
          <Meta label={t("started")} value={formatDateTime(exec.startedAt, locale)} />
          <Meta
            label={t("finished")}
            value={exec.finishedAt ? formatRelative(exec.finishedAt, locale) : t("running")}
          />
        </div>

        {exec.error && (
          <div className="mt-4 rounded-md border border-[color:var(--err)]/30 bg-[color:var(--err)]/10 px-3 py-2 font-mono text-[13px] text-[color:var(--err)]">
            {exec.error}
          </div>
        )}
      </Card>

      {/* trigger payload */}
      <div className="mb-5">
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-faint">
          {t("triggerPayload")}
        </h2>
        <CodeBlock value={exec.input} label="input" />
      </div>

      {/* steps */}
      <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-faint">
        {t("steps")}
      </h2>
      {exec.nodeRuns.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-muted">
          {t("noSteps")}
        </p>
      ) : (
        <div className="space-y-2">
          {exec.nodeRuns.map((run, idx) => (
            <StepRow
              key={run.id}
              run={run}
              index={idx}
              open={!!open[run.id]}
              onToggle={() => setOpen((o) => ({ ...o, [run.id]: !o[run.id] }))}
              labels={{
                kind: (k: string) => {
                  try {
                    return tNodeKind(k);
                  } catch {
                    return k;
                  }
                },
                status: (s: string) => tStatus(s),
                input: t("input"),
                output: t("output"),
                error: t("errorLabel"),
                duration: t("stepDuration"),
              }}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-fg">{value}</div>
    </div>
  );
}

function StepRow({
  run,
  index,
  open,
  onToggle,
  labels,
  locale,
}: {
  run: NodeRun;
  index: number;
  open: boolean;
  onToggle: () => void;
  labels: {
    kind: (k: string) => string;
    status: (s: string) => string;
    input: string;
    output: string;
    error: string;
    duration: string;
  };
  locale: string;
}) {
  const Icon = nodeIcon(run.nodeKind);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-stretch gap-0 text-left transition-colors hover:bg-[var(--surface-hover)]"
      >
        {/* status rail */}
        <span
          className={cn(
            "w-1 shrink-0",
            railColor[run.status] ?? "bg-[var(--text-faint)]",
            run.status === "RUNNING" && "animate-pulse-rail",
          )}
        />
        <div className="flex flex-1 items-center gap-3 px-4 py-3">
          <span className="font-mono text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
            <Icon size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm font-medium text-fg">{run.nodeName}</div>
            <div className="font-mono text-[11px] text-faint">{labels.kind(run.nodeKind)}</div>
          </div>
          <Badge variant={execStatusVariant(run.status)} dot>
            {labels.status(run.status)}
          </Badge>
          <span className="hidden font-mono text-xs text-muted sm:inline">
            {formatDuration(run.durationMs, locale)}
          </span>
          {open ? (
            <ChevronDown size={16} className="text-faint" />
          ) : (
            <ChevronRight size={16} className="text-faint" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-soft)] p-4">
          {run.error && (
            <div className="mb-3 rounded-md border border-[color:var(--err)]/30 bg-[color:var(--err)]/10 px-3 py-2 font-mono text-[13px] text-[color:var(--err)]">
              <span className="mr-2 uppercase opacity-70">{labels.error}</span>
              {run.error}
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <CodeBlock value={run.input} label={labels.input} />
            <CodeBlock value={run.output} label={labels.output} />
          </div>
        </div>
      )}
    </Card>
  );
}
