"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { nodeIcon } from "@/lib/node-meta";
import { cn } from "@/lib/cn";
import type { ExecStatus } from "@/lib/types";
import { catalogFor } from "./node-catalog";
import type { FluxoNodeData } from "./serialize";

/** Status of a node within the currently-viewed run (or idle when not viewing one). */
export type NodeRunStatus = ExecStatus | "IDLE";

const railClass: Record<NodeRunStatus, string> = {
  IDLE: "bg-[var(--text-faint)]",
  RUNNING: "bg-[color:var(--signal)] animate-pulse-rail",
  SUCCESS: "bg-[color:var(--ok)]",
  ERROR: "bg-[color:var(--err)]",
};

function FluxoNodeInner({ data, selected }: NodeProps) {
  const d = data as FluxoNodeData;
  const tShort = useTranslations("nodeKindsShort");
  const tEditor = useTranslations("editor");

  const entry = catalogFor(d.kind);
  const Icon = nodeIcon(d.kind);
  const status: NodeRunStatus = (d.status as NodeRunStatus) ?? "IDLE";
  const hasTarget = entry?.hasTarget ?? !d.kind.startsWith("trigger.");
  const sourceHandles = entry?.sourceHandles ?? [{ id: null }];
  const accent = entry?.accent ?? "var(--primary)";
  const branching = sourceHandles.length > 1;

  return (
    <div
      className={cn(
        "group relative w-[210px] rounded-md border bg-[var(--surface)] shadow-sm transition-shadow",
        selected
          ? "border-[var(--primary)] glow-ring"
          : "border-[var(--border)] hover:border-[var(--primary)]/60",
      )}
    >
      {/* incoming edge handle (left) */}
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!-left-[5px]"
          isConnectableStart={false}
        />
      )}

      <div
        className={cn(
          "flex items-stretch overflow-hidden",
          branching ? "rounded-t-md" : "rounded-md",
        )}
      >
        {/* left status rail */}
        <span
          className={cn("w-1.5 shrink-0", railClass[status])}
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
          {/* tinted kind chip */}
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
            style={{
              color: accent,
              borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            }}
          >
            <Icon size={16} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[13px] font-semibold leading-tight text-fg">
              {d.name || tEditor("untitledNode")}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-wide text-faint">
              {tShort(d.kind)}
            </div>
          </div>
        </div>
      </div>

      {/* source handle(s) on the right */}
      {sourceHandles.length <= 1 ? (
        <Handle
          type="source"
          position={Position.Right}
          id={sourceHandles[0]?.id ?? undefined}
          className="!-right-[5px]"
        />
      ) : (
        <div className="relative flex flex-col gap-1 rounded-b-md border-t border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5">
          {sourceHandles.map((h, i) => (
            <div key={h.id ?? i} className="relative flex h-4 items-center justify-end pr-1.5">
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide",
                  h.id === "true" ? "text-[color:var(--ok)]" : "text-[color:var(--err)]",
                )}
              >
                {h.labelKey ? tEditor(`handle.${h.labelKey}`) : h.id}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={h.id ?? undefined}
                className={cn(
                  "!-right-[17px]",
                  h.id === "true"
                    ? "!border-[color:var(--ok)]"
                    : "!border-[color:var(--err)]",
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const FluxoNode = memo(FluxoNodeInner);
