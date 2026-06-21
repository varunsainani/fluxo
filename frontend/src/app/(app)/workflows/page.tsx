"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Workflow as WorkflowIcon, Trash2, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Workflow, WorkflowListItem } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatRelative } from "@/lib/format";
import { triggerIcon } from "@/lib/node-meta";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export default function WorkflowsPage() {
  const t = useTranslations("workflows");
  const tc = useTranslations("common");
  const tTrig = useTranslations("triggers");
  const tStatus = useTranslations("status");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const router = useRouter();
  const toApiError = useApiError();
  const toast = useToast();

  const [items, setItems] = useState<WorkflowListItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [pendingActive, setPendingActive] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<WorkflowListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.get<WorkflowListItem[]>("/workflows");
      setItems(list);
    } catch (e) {
      toast.error(toApiError(e));
      setItems([]);
    }
  }, [toApiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const wf = await api.post<Workflow>("/workflows", {
        name: newName.trim(),
        description: newDesc.trim(),
      });
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      toast.error(toApiError(e));
      setCreating(false);
    }
  };

  const toggleActive = async (wf: WorkflowListItem, next: boolean) => {
    setPendingActive((p) => ({ ...p, [wf.id]: next }));
    setItems((cur) => cur?.map((w) => (w.id === wf.id ? { ...w, active: next } : w)) ?? cur);
    try {
      await api.patch(`/workflows/${wf.id}`, { active: next });
      toast.success(next ? tToast("activated") : tToast("deactivated"));
    } catch (e) {
      // revert
      setItems((cur) => cur?.map((w) => (w.id === wf.id ? { ...w, active: !next } : w)) ?? cur);
      toast.error(toApiError(e));
    } finally {
      setPendingActive((p) => {
        const rest = { ...p };
        delete rest[wf.id];
        return rest;
      });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/workflows/${toDelete.id}`);
      setItems((cur) => cur?.filter((w) => w.id !== toDelete.id) ?? cur);
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
          icon={WorkflowIcon}
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((wf) => {
            const TrigIcon = triggerIcon(wf.trigger);
            const active = pendingActive[wf.id] ?? wf.active;
            return (
              <Card key={wf.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-4">
                  <Link href={`/workflows/${wf.id}`} className="group min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
                        <TrigIcon size={15} />
                      </span>
                      <h3 className="truncate font-mono text-sm font-semibold text-fg group-hover:text-[var(--primary)]">
                        {wf.name}
                      </h3>
                    </div>
                    {wf.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted">{wf.description}</p>
                    )}
                  </Link>
                  <Switch
                    checked={active}
                    onChange={(next) => toggleActive(wf, next)}
                    label={active ? t("deactivate") : t("activate")}
                  />
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">
                      {wf.trigger ? tTrig(wf.trigger) : tTrig("NONE")}
                    </Badge>
                    {wf.lastExecution ? (
                      <StatusBadge
                        status={wf.lastExecution.status}
                        label={tStatus(wf.lastExecution.status)}
                      />
                    ) : (
                      <span className="font-mono text-[11px] text-faint">{t("noRuns")}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setToDelete(wf)}
                    aria-label={t("deleteTitle")}
                    className="rounded p-1 text-faint transition-colors hover:text-[color:var(--err)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-faint">
                  <span className="font-mono">
                    {wf.lastExecution
                      ? formatRelative(wf.lastExecution.startedAt, locale)
                      : t("updatedAgo", { time: formatRelative(wf.updatedAt, locale) })}
                  </span>
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="inline-flex items-center gap-1 font-mono text-[var(--primary)] hover:underline"
                  >
                    {t("open")}
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* new workflow modal */}
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
            <Button onClick={create} loading={creating} disabled={!newName.trim()}>
              {t("new")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="wf-name">{tc("name")}</Label>
            <Input
              id="wf-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <div>
            <Label htmlFor="wf-desc">{tc("description")}</Label>
            <Textarea
              id="wf-desc"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
        </div>
      </Modal>

      {/* delete confirm */}
      <Modal
        open={!!toDelete}
        onClose={() => !deleting && setToDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              <Trash2 size={15} />
              {tc("delete")}
            </Button>
          </>
        }
      >
        {toDelete && (
          <p className="font-mono text-sm text-fg">{toDelete.name}</p>
        )}
      </Modal>
    </div>
  );
}
