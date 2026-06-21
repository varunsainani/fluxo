"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PlayCircle, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import type { ExecSummary, WorkflowListItem } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatRelative, formatDuration } from "@/lib/format";
import { triggerIcon } from "@/lib/node-meta";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";

function ExecutionsInner() {
  const t = useTranslations("executions");
  const tTrig = useTranslations("triggers");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const toApiError = useApiError();

  const workflowId = params.get("workflowId") ?? "";

  const [execs, setExecs] = useState<ExecSummary[] | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load the workflow list once (for the filter + name lookup).
  useEffect(() => {
    api.get<WorkflowListItem[]>("/workflows").then(setWorkflows).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setExecs(null);
    setError(null);
    try {
      const qs = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}&limit=100` : "?limit=100";
      setExecs(await api.get<ExecSummary[]>(`/executions${qs}`));
    } catch (e) {
      setError(toApiError(e));
      setExecs([]);
    }
  }, [workflowId, toApiError]);

  useEffect(() => {
    load();
  }, [load]);

  const wfName = (id: string) => workflows.find((w) => w.id === id)?.name ?? id;

  const onFilter = (value: string) => {
    router.push(value ? `/executions?workflowId=${value}` : "/executions");
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          workflows.length > 0 && (
            <div className="w-56">
              <Select value={workflowId} onChange={(e) => onFilter(e.target.value)}>
                <option value="">{t("allWorkflows")}</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
          )
        }
      />

      {execs === null ? (
        <SkeletonRows count={6} />
      ) : execs.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title={error ?? t("empty")}
          description={error ? undefined : t("emptyHint")}
        />
      ) : (
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {/* header row (desktop) */}
          <div className="hidden grid-cols-[110px_110px_1fr_90px_120px_24px] gap-3 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide text-faint md:grid">
            <span>{t("status")}</span>
            <span>{t("trigger")}</span>
            <span>{t("workflow")}</span>
            <span>{t("duration")}</span>
            <span>{t("started")}</span>
            <span />
          </div>
          {execs.map((ex) => {
            const TrigIcon = triggerIcon(ex.trigger);
            return (
              <button
                key={ex.id}
                onClick={() => router.push(`/executions/${ex.id}`)}
                className="grid w-full grid-cols-2 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] md:grid-cols-[110px_110px_1fr_90px_120px_24px]"
              >
                <StatusBadge status={ex.status} label={tStatus(ex.status)} />
                <Badge variant="idle" className="w-fit">
                  <TrigIcon size={11} />
                  {tTrig(ex.trigger)}
                </Badge>
                <span className="truncate font-mono text-sm text-fg">{wfName(ex.workflowId)}</span>
                <span className="font-mono text-xs text-muted">{formatDuration(ex.durationMs, locale)}</span>
                <span className="hidden font-mono text-xs text-faint md:inline">
                  {formatRelative(ex.startedAt, locale)}
                </span>
                <ArrowUpRight size={14} className="hidden justify-self-end text-faint md:block" />
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

export default function ExecutionsPage() {
  return (
    <Suspense fallback={<SkeletonRows count={6} />}>
      <ExecutionsInner />
    </Suspense>
  );
}
