"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const pos: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-medium text-fg shadow-lg",
            pos[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
