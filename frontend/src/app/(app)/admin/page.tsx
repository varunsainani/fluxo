"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Users,
  Workflow as WorkflowIcon,
  Activity,
  PlayCircle,
  Gauge,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdminOverview, AdminUser } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatNumber, formatPercent, formatRelative, formatDuration } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPage() {
  const t = useTranslations("admin");
  const tStatus = useTranslations("status");
  const tRole = useTranslations("roles");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toApiError = useApiError();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  // redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "ADMIN") {
      router.replace("/workflows");
    }
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const [ov, us] = await Promise.all([
        api.get<AdminOverview>("/admin/overview"),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setOverview(ov);
      setUsers(us);
    } catch (e) {
      const ae = e as { status?: number };
      if (ae.status === 403) setForbidden(true);
      else toApiError(e);
    } finally {
      setLoading(false);
    }
  }, [toApiError]);

  useEffect(() => {
    if (user?.role === "ADMIN") load();
  }, [user, load]);

  if (forbidden || (user && user.role !== "ADMIN")) {
    return <EmptyState icon={ShieldAlert} title={t("denied")} description={t("deniedHint")} />;
  }

  const stats: { Icon: LucideIcon; label: string; value: string }[] = overview
    ? [
        { Icon: Users, label: t("statUsers"), value: formatNumber(overview.stats.users, locale) },
        { Icon: WorkflowIcon, label: t("statWorkflows"), value: formatNumber(overview.stats.workflows, locale) },
        { Icon: Activity, label: t("statActive"), value: formatNumber(overview.stats.activeWorkflows, locale) },
        { Icon: PlayCircle, label: t("statExecutions"), value: formatNumber(overview.stats.executions, locale) },
        {
          Icon: Gauge,
          label: t("statSuccessRate"),
          value: formatPercent(overview.stats.successRate, locale, false),
        },
      ]
    : [];

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map(({ Icon, label, value }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 text-faint">
                <Icon size={15} className="text-[var(--primary)]" />
                <span className="font-mono text-[11px] uppercase tracking-wide">{label}</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-fg">{value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* recent executions */}
      <h2 className="mb-2 mt-8 font-mono text-xs font-semibold uppercase tracking-wide text-faint">
        {t("recentExecutions")}
      </h2>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !overview || overview.recentExecutions.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-muted">
          {t("recentEmpty")}
        </p>
      ) : (
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {overview.recentExecutions.map((ex) => (
            <Link
              key={ex.id}
              href={`/executions/${ex.id}`}
              className="grid grid-cols-2 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] md:grid-cols-[110px_1fr_1fr_90px_110px]"
            >
              <StatusBadge status={ex.status} label={tStatus(ex.status)} />
              <span className="truncate font-mono text-sm text-fg">{ex.workflowName || t("noWorkflowName")}</span>
              <span className="truncate text-xs text-muted">{ex.user?.name ?? ex.user?.email}</span>
              <span className="hidden font-mono text-xs text-muted md:inline">
                {formatDuration(ex.durationMs, locale)}
              </span>
              <span className="hidden font-mono text-xs text-faint md:inline">
                {formatRelative(ex.startedAt, locale)}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {/* users */}
      <h2 className="mb-2 mt-8 font-mono text-xs font-semibold uppercase tracking-wide text-faint">
        {t("usersTitle")}
      </h2>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !users || users.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-muted">
          {t("recentEmpty")}
        </p>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  {[t("userName"), t("userEmail"), t("userRole"), t("userWorkflows"), t("userExecutions"), t("userJoined")].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] uppercase tracking-wide text-faint"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--border-soft)] transition-colors last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-3 py-2.5 text-sm text-fg">{u.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={u.role === "ADMIN" ? "brand" : "idle"}>{tRole(u.role)}</Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-fg">
                      {formatNumber(u.workflowCount, locale)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-fg">
                      {formatNumber(u.executionCount, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-faint">
                      {formatRelative(u.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
