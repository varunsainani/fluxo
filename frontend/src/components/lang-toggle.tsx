"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages, Check } from "lucide-react";
import { locales, localeNames, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LangToggle({ className }: { className?: string }) {
  const active = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const choose = (loc: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${loc}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg hover:bg-[var(--surface-hover)]"
      >
        <Languages size={15} />
        <span className="font-mono uppercase">{active}</span>
      </button>
      {open && (
        <div className="animate-in absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => choose(loc)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)]",
                loc === active ? "text-fg" : "text-muted",
              )}
            >
              {localeNames[loc]}
              {loc === active && <Check size={14} className="text-[var(--primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
