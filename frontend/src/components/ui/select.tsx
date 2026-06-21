"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--bg-soft)] pl-3 pr-9 text-sm text-fg outline-none transition-all duration-150 focus:border-[var(--primary)] focus:glow-ring disabled:opacity-60",
          invalid && "border-[color:var(--err)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
});
