"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Database, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { DatastoreDetail } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function DatastoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("datastores");
  const tc = useTranslations("common");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const router = useRouter();
  const toApiError = useApiError();
  const toast = useToast();

  const [ds, setDs] = useState<DatastoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setDs(await api.get<DatastoreDetail>(`/datastores/${id}?limit=200`));
    } catch (e) {
      const ae = e as { status?: number };
      if (ae.status === 404) setNotFound(true);
      else toast.error(toApiError(e));
    } finally {
      setLoading(false);
    }
  }, [id, toApiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async () => {
    setDeleting(true);
    try {
      await api.del(`/datastores/${id}`);
      toast.success(tToast("deleted"));
      router.push("/datastores");
    } catch (e) {
      toast.error(toApiError(e));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !ds) {
    return (
      <EmptyState
        icon={Database}
        title={tc("unknownError")}
        action={
          <Link
            href="/datastores"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            <ArrowLeft size={14} />
            {t("title")}
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Link
        href="/datastores"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} />
        {t("title")}
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
            <Database size={18} />
          </span>
          <div>
            <h1 className="font-mono text-lg font-semibold text-fg">{ds.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="brand">{t("totalRows", { count: ds.total })}</Badge>
              <Badge variant="idle">{t("columns", { count: ds.columns.length })}</Badge>
            </div>
          </div>
        </div>
        <Button variant="danger" onClick={() => setConfirmDel(true)}>
          <Trash2 size={15} />
          {tc("delete")}
        </Button>
      </div>

      {ds.rows.length === 0 ? (
        <EmptyState icon={Database} title={t("noRows")} description={t("noRowsHint")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-3 py-2.5 font-mono text-[11px] uppercase tracking-wide text-faint">#</th>
                  {ds.columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] uppercase tracking-wide text-faint"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] uppercase tracking-wide text-faint">
                    {t("createdRow")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ds.rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border-soft)] transition-colors last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-faint">
                      {formatNumber(i + 1, locale)}
                    </td>
                    {ds.columns.map((col) => (
                      <td
                        key={col}
                        className="max-w-[260px] truncate px-3 py-2 font-mono text-[13px] text-fg"
                        title={cellValue(row.data[col])}
                      >
                        {cellValue(row.data[col])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-faint">
                      {formatDateTime(row.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={onDelete}
        loading={deleting}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        body={<p className="font-mono text-sm text-fg">{ds.name}</p>}
      />
    </div>
  );
}
