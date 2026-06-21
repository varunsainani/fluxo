"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Check, CheckCheck, Trash2, Inbox, Slack, MessageCircle, Mail } from "lucide-react";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const channelIcon = (channel: string) => {
  switch (channel) {
    case "slack":
      return Slack;
    case "whatsapp":
      return MessageCircle;
    case "email":
      return Mail;
    default:
      return Inbox;
  }
};

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tChannel = useTranslations("channels");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const toApiError = useApiError();
  const toast = useToast();

  const [items, setItems] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setItems(await api.get<Notification[]>("/notifications"));
    } catch (e) {
      toast.error(toApiError(e));
      setItems([]);
    }
  }, [toApiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(() => items?.filter((n) => !n.read).length ?? 0, [items]);
  const visible = useMemo(
    () => (filter === "unread" ? (items ?? []).filter((n) => !n.read) : items ?? []),
    [items, filter],
  );

  const setRead = async (n: Notification, read: boolean) => {
    setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read } : x)) ?? cur);
    try {
      await api.patch(`/notifications/${n.id}`, { read });
    } catch (e) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: !read } : x)) ?? cur);
      toast.error(toApiError(e));
    }
  };

  const markAll = async () => {
    const prev = items;
    setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? cur);
    try {
      await api.post("/notifications/read-all");
      toast.success(tToast("markedAllRead"));
    } catch (e) {
      setItems(prev);
      toast.error(toApiError(e));
    }
  };

  const remove = async (n: Notification) => {
    const prev = items;
    setItems((cur) => cur?.filter((x) => x.id !== n.id) ?? cur);
    try {
      await api.del(`/notifications/${n.id}`);
    } catch (e) {
      setItems(prev);
      toast.error(toApiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button variant="outline" onClick={markAll} disabled={unreadCount === 0}>
            <CheckCheck size={15} />
            {t("markAllRead")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("filterAll")}
        </FilterChip>
        <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")}>
          {unreadCount > 0 ? t("unread", { count: unreadCount }) : t("filterUnread")}
        </FilterChip>
      </div>

      {items === null ? (
        <SkeletonRows count={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? t("allRead") : t("empty")}
          description={filter === "unread" ? undefined : t("emptyHint")}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((n) => {
            const Icon = channelIcon(n.channel);
            return (
              <Card
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors",
                  !n.read && "border-l-2 border-l-[var(--primary)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)]",
                    n.read ? "bg-[var(--surface-2)] text-muted" : "bg-[var(--surface-2)] text-[var(--primary)]",
                  )}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        "truncate text-sm",
                        n.read ? "font-medium text-muted" : "font-semibold text-fg",
                      )}
                    >
                      {n.title}
                    </h3>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{n.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="idle">{tChannel(n.channel)}</Badge>
                    <span className="font-mono text-[11px] text-faint">
                      {formatRelative(n.createdAt, locale)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setRead(n, !n.read)}
                    aria-label={n.read ? t("markUnread") : t("markRead")}
                    className="rounded p-1.5 text-faint transition-colors hover:text-[var(--primary)]"
                    title={n.read ? t("markUnread") : t("markRead")}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => remove(n)}
                    aria-label={t("deleteTitle")}
                    className="rounded p-1.5 text-faint transition-colors hover:text-[color:var(--err)]"
                    title={t("deleteTitle")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
