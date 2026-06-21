"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

function pretty(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    // If it's already a JSON string, try to pretty-print it; else show raw.
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function CodeBlock({
  value,
  label,
  copyable = true,
  className,
  maxHeight = 320,
}: {
  value: unknown;
  label?: string;
  copyable?: boolean;
  className?: string;
  maxHeight?: number;
}) {
  const [copied, setCopied] = useState(false);
  const text = pretty(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-soft)]",
        className,
      )}
    >
      {(label || copyable) && (
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</span>
          {copyable && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:text-fg"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
        </div>
      )}
      <pre
        className="overflow-auto p-3 font-mono text-[12.5px] leading-relaxed text-fg"
        style={{ maxHeight }}
      >
        <code>{text}</code>
      </pre>
    </div>
  );
}
