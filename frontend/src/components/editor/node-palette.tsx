"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { nodeIcon } from "@/lib/node-meta";
import { cn } from "@/lib/cn";
import type { NodeKind } from "@/lib/types";
import { ACTION_KINDS, TRIGGER_KINDS, catalogFor } from "./node-catalog";

/** dataTransfer key for drag-to-canvas. */
export const DND_MIME = "application/fluxo-node";

export function NodePalette({
  onAdd,
  hasTrigger,
}: {
  /** Click-to-add: drop the node near canvas center (handled by the canvas). */
  onAdd: (kind: NodeKind) => void;
  /** Whether the graph already has a trigger (used to dim extra triggers). */
  hasTrigger: boolean;
}) {
  const tNodes = useTranslations("nodes");
  const tKinds = useTranslations("nodeKinds");
  const tDesc = useTranslations("nodeKindsDesc");
  const tEditor = useTranslations("editor");
  const [q, setQ] = useState("");

  const filter = (kinds: NodeKind[]) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return kinds;
    return kinds.filter(
      (k) => tKinds(k).toLowerCase().includes(needle) || tDesc(k).toLowerCase().includes(needle),
    );
  };

  const triggers = useMemo(() => filter(TRIGGER_KINDS), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const actions = useMemo(() => filter(ACTION_KINDS), [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData(DND_MIME, kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const Item = ({ kind }: { kind: NodeKind }) => {
    const entry = catalogFor(kind);
    const Icon = nodeIcon(kind);
    const accent = entry?.accent ?? "var(--primary)";
    const dim = entry?.category === "trigger" && hasTrigger;
    return (
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, kind)}
        onClick={() => onAdd(kind)}
        title={dim ? tEditor("triggerExists") : tNodes("dragHint")}
        className={cn(
          "group flex w-full items-start gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
          "hover:border-[var(--border)] hover:bg-[var(--surface-hover)] active:scale-[0.99]",
          "cursor-grab active:cursor-grabbing",
          dim && "opacity-60",
        )}
      >
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          style={{
            color: accent,
            borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          }}
        >
          <Icon size={14} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-[12.5px] font-medium text-fg">
            {tKinds(kind)}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-faint">{tDesc(kind)}</span>
        </span>
      </button>
    );
  };

  const Group = ({ title, kinds }: { title: string; kinds: NodeKind[] }) =>
    kinds.length === 0 ? null : (
      <div>
        <div className="px-2.5 pb-1.5 pt-3 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-faint">
          {title}
        </div>
        <div className="flex flex-col gap-0.5">
          {kinds.map((k) => (
            <Item key={k} kind={k} />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">
            {tNodes("palette")}
          </span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tEditor("searchNodes")}
            className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-soft)] pl-8 pr-2 text-xs text-fg placeholder:text-faint outline-none focus:border-[var(--primary)] focus:glow-ring"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
        <Group title={tNodes("trigger")} kinds={triggers} />
        <Group title={tNodes("action")} kinds={actions} />
        {triggers.length === 0 && actions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-faint">{tEditor("noMatches")}</p>
        )}
      </div>
    </div>
  );
}
