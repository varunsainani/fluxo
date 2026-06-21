"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Plug, Trash2, Pencil, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Connection, HeaderPair } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface Draft {
  id?: string;
  name: string;
  baseUrl: string;
  headers: HeaderPair[];
}

const emptyDraft = (): Draft => ({ name: "", baseUrl: "", headers: [] });

export default function ConnectionsPage() {
  const t = useTranslations("connections");
  const tc = useTranslations("common");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const toApiError = useApiError();
  const toast = useToast();

  const [items, setItems] = useState<Connection[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<Connection[]>("/connections"));
    } catch (e) {
      toast.error(toApiError(e));
      setItems([]);
    }
  }, [toApiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setDraft(emptyDraft());
  const openEdit = (c: Connection) =>
    setDraft({ id: c.id, name: c.name, baseUrl: c.baseUrl, headers: c.headers.map((h) => ({ ...h })) });

  const updateDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const setHeader = (idx: number, patch: Partial<HeaderPair>) =>
    setDraft((d) =>
      d ? { ...d, headers: d.headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)) } : d,
    );
  const addHeader = () => setDraft((d) => (d ? { ...d, headers: [...d.headers, { key: "", value: "" }] } : d));
  const removeHeader = (idx: number) =>
    setDraft((d) => (d ? { ...d, headers: d.headers.filter((_, i) => i !== idx) } : d));

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      headers: draft.headers.filter((h) => h.key.trim()),
    };
    try {
      if (draft.id) {
        const updated = await api.patch<Connection>(`/connections/${draft.id}`, payload);
        setItems((cur) => cur?.map((c) => (c.id === updated.id ? updated : c)) ?? cur);
        toast.success(tToast("updated"));
      } else {
        const created = await api.post<Connection>("/connections", payload);
        setItems((cur) => [created, ...(cur ?? [])]);
        toast.success(tToast("created"));
      }
      setDraft(null);
    } catch (e) {
      toast.error(toApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/connections/${toDelete.id}`);
      setItems((cur) => cur?.filter((c) => c.id !== toDelete.id) ?? cur);
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
          <Button onClick={openNew}>
            <Plus size={16} />
            {t("new")}
          </Button>
        }
      />

      {items === null ? (
        <SkeletonRows count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button onClick={openNew}>
              <Plus size={16} />
              {t("createFirst")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
                    <Plug size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-sm font-semibold text-fg">{c.name}</h3>
                    <p className="truncate font-mono text-xs text-muted">
                      {c.baseUrl || <span className="text-faint">{tc("none")}</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {c.headers.length === 0 ? (
                    <span className="font-mono text-[11px] text-faint">{t("noHeaders")}</span>
                  ) : (
                    c.headers.map((h, i) => (
                      <Badge key={i} variant="idle">
                        {h.key}
                      </Badge>
                    ))
                  )}
                  <span className="ml-1 font-mono text-[11px] text-faint">
                    {formatRelative(c.createdAt, locale)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(c)}
                  aria-label={t("editTitle")}
                  className="rounded p-1.5 text-faint transition-colors hover:text-[var(--primary)]"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setToDelete(c)}
                  aria-label={t("deleteTitle")}
                  className="rounded p-1.5 text-faint transition-colors hover:text-[color:var(--err)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* create/edit modal */}
      <Modal
        open={!!draft}
        onClose={() => !saving && setDraft(null)}
        title={draft?.id ? t("editTitle") : t("newTitle")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={save} loading={saving} disabled={!draft?.name.trim()}>
              {tc("save")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="conn-name">{tc("name")}</Label>
              <Input
                id="conn-name"
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="conn-url">{t("baseUrl")}</Label>
              <Input
                id="conn-url"
                value={draft.baseUrl}
                onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                placeholder={t("baseUrlPlaceholder")}
                mono
              />
            </div>
            <div>
              <Label hint={t("headersHint")}>{t("headers")}</Label>
              <div className="space-y-2">
                {draft.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={h.key}
                      onChange={(e) => setHeader(i, { key: e.target.value })}
                      placeholder={t("headerKeyPlaceholder")}
                      mono
                      className="flex-1"
                    />
                    <Input
                      value={h.value}
                      onChange={(e) => setHeader(i, { value: e.target.value })}
                      placeholder={t("headerValuePlaceholder")}
                      mono
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeHeader(i)}
                      aria-label={tc("remove")}
                      className="shrink-0 rounded p-2 text-faint transition-colors hover:text-[color:var(--err)]"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <Button variant="subtle" size="sm" onClick={addHeader}>
                  <Plus size={14} />
                  {t("addHeader")}
                </Button>
              </div>
            </div>
          </div>
        )}
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
