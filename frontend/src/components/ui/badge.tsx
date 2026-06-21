import { cn } from "@/lib/cn";
import type { ExecStatus } from "@/lib/types";

type BadgeVariant = "running" | "success" | "error" | "idle" | "brand" | "neutral";

const variants: Record<BadgeVariant, string> = {
  running:
    "border-[color:var(--signal)]/30 bg-[color:var(--signal)]/10 text-[color:var(--signal)]",
  success: "border-[color:var(--ok)]/30 bg-[color:var(--ok)]/10 text-[color:var(--ok)]",
  error: "border-[color:var(--err)]/30 bg-[color:var(--err)]/10 text-[color:var(--err)]",
  idle: "border-[var(--border)] bg-[var(--surface-2)] text-muted",
  brand: "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]",
  neutral: "border-[var(--border)] bg-[var(--surface-2)] text-fg",
};

const dotColor: Record<BadgeVariant, string> = {
  running: "bg-[color:var(--signal)]",
  success: "bg-[color:var(--ok)]",
  error: "bg-[color:var(--err)]",
  idle: "bg-[var(--text-faint)]",
  brand: "bg-[var(--primary)]",
  neutral: "bg-[var(--text-muted)]",
};

export function Badge({
  variant = "neutral",
  children,
  dot,
  className,
  mono = true,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium leading-5",
        mono && "font-mono",
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotColor[variant],
            variant === "running" && "animate-pulse-rail",
          )}
        />
      )}
      {children}
    </span>
  );
}

export function execStatusVariant(status: ExecStatus): BadgeVariant {
  switch (status) {
    case "RUNNING":
      return "running";
    case "SUCCESS":
      return "success";
    case "ERROR":
      return "error";
    default:
      return "idle";
  }
}

/** Convenience: status badge that maps ExecStatus -> variant + label. */
export function StatusBadge({ status, label }: { status: ExecStatus; label: string }) {
  return (
    <Badge variant={execStatusVariant(status)} dot>
      {label}
    </Badge>
  );
}
