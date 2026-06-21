"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 outline-none focus-visible:glow-ring disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] hover:brightness-110 hover:glow-ring active:brightness-95",
  outline:
    "border border-[var(--border)] bg-[var(--surface)] text-fg hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]",
  ghost: "text-muted hover:text-fg hover:bg-[var(--surface-hover)]",
  subtle: "bg-[var(--surface-2)] text-fg hover:bg-[var(--surface-hover)]",
  danger:
    "border border-[color:var(--err)] bg-[color:var(--err)]/10 text-[color:var(--err)] hover:bg-[color:var(--err)]/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});
