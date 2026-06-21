"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-soft)] px-3 text-sm text-fg placeholder:text-faint outline-none transition-all duration-150 focus:border-[var(--primary)] focus:glow-ring disabled:opacity-60 disabled:cursor-not-allowed";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, mono, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        fieldBase,
        "h-9",
        mono && "font-mono",
        invalid && "border-[color:var(--err)] focus:border-[color:var(--err)]",
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, mono, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        "py-2 min-h-[88px] resize-y leading-relaxed",
        mono && "font-mono text-[13px]",
        invalid && "border-[color:var(--err)] focus:border-[color:var(--err)]",
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  children,
  htmlFor,
  hint,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-xs font-medium text-muted mb-1.5", className)}>
      {children}
      {hint && <span className="ml-1 font-normal text-faint">{hint}</span>}
    </label>
  );
}
