"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Database, Trash2, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import type { DatastoreListItem } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatRelative, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export default function DatastoresPage() {
  const t = useTranslations("datastores");
  const tc = useTranslations("common");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const toApiError = useApiError();
  const toast = useToast();

  const [items, setItems] = useState<DatastoreListItem[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<DatastoreListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<DatastoreListItem[]>("/datastores"));
    } catch (e) {
      toast.error(toApiError(e));
      setItems([]);
    }
  }, [toApiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ds = await api.post<DatastoreListItem>("/datastores", { name: name.trim() });
      setItems((cur) => [ds, ...(cur ?? [])]);
      toast.success(tToast("created"));
      setShowNew(false);
      setName("");
    } catch (e) {
      toast.error(toApiError(e));
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/datastores/${toDelete.id}`);
      setItems((cur) => cur?.filter((d) => d.id !== toDelete.id) ?? cur);
      toast.success(tToast("deleted"));
      setToDelete(null);
    } catch (e) {
      toast.error(toApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus size={16} />
            {t("new")}
          </Button>
        }
      />

      {items === null ? (
        <SkeletonRows count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Database}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus size={16} />
              {t("createFirst")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ds) => (
            <Card key={ds.id} interactive className="group relative">
              <Link href={`/datastores/${ds.id}`} className="block p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
                    <Database size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-sm font-semibold text-fg group-hover:text-[var(--primary)]">
                      {ds.name}
                    </h3>
                    <p className="font-mono text-[11px] text-faint">
                      {t("rows", { count: ds.rowCount })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-[11px]">
                  <span className="font-mono text-faint">
                    {formatNumber(ds.rowCount, locale)} · {formatRelative(ds.createdAt, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[var(--primary)]">
                    {t("open")}
                    <ArrowUpRight size={12} />
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setToDelete(ds)}
                aria-label={t("deleteTitle")}
                className="absolute right-2 top-2 rounded p-1.5 text-faint opacity-0 transition-opacity hover:text-[color:var(--err)] group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showNew}
        onClose={() => !creating && setShowNew(false)}
        title={t("newModalTitle")}
        description={t("newModalHint")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNew(false)} disabled={creating}>
              {tc("cancel")}
            </Button>
            <Button onClick={create} loading={creating} disabled={!name.trim()}>
              {tc("create")}
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="ds-name">{tc("name")}</Label>
          <Input
            id="ds-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        body={toDelete && <p className="font-mono text-sm text-fg">{toDelete.name}</p>}
      />
    </div>
  );
}
