"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const accent: Record<ToastKind, string> = {
  success: "text-[color:var(--ok)]",
  error: "text-[color:var(--err)]",
  info: "text-[var(--primary)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const [mounted, setMounted] = useState(false);

  // Defer portal until client to avoid hydration mismatch.
  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter.current;
      setItems((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m: string) => toast(m, "success"),
      error: (m: string) => toast(m, "error"),
      info: (m: string) => toast(m, "info"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
            {items.map((t) => {
              const Icon = icons[t.kind];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 shadow-xl",
                    "animate-in",
                  )}
                >
                  <Icon size={17} className={cn("mt-0.5 shrink-0", accent[t.kind])} />
                  <p className="flex-1 text-sm text-fg">{t.message}</p>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="shrink-0 text-faint transition-colors hover:text-fg"
                    aria-label={tCommon("dismiss")}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
