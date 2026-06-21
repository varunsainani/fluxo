"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Workflow,
  PlayCircle,
  Database,
  Bell,
  Plug,
  Settings,
  ShieldCheck,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Topbar } from "@/components/topbar";

interface NavItem {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/workflows", labelKey: "workflows", Icon: Workflow },
  { href: "/executions", labelKey: "executions", Icon: PlayCircle },
  { href: "/datastores", labelKey: "datastores", Icon: Database },
  { href: "/notifications", labelKey: "notifications", Icon: Bell },
  { href: "/connections", labelKey: "connections", Icon: Plug },
  { href: "/settings", labelKey: "settings", Icon: Settings },
  { href: "/admin", labelKey: "admin", Icon: ShieldCheck, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const items = NAV.filter((i) => !i.adminOnly || user?.role === "ADMIN");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navList = (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map(({ href, labelKey, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 font-mono text-sm transition-colors",
              active
                ? "bg-[var(--surface-2)] text-fg"
                : "text-muted hover:bg-[var(--surface-hover)] hover:text-fg",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[linear-gradient(var(--primary-strong),var(--accent))]" />
            )}
            <Icon size={17} className={cn(active ? "text-[var(--primary)]" : "")} />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-grid">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-soft)]/80 backdrop-blur-sm lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-5">
          <Logo size={22} />
          <span className="font-mono text-sm font-semibold tracking-tight">fluxo</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">{navList}</div>
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="font-mono text-[11px] text-faint">v1.0 · {user?.role.toLowerCase()}</p>
        </div>
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-in absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-soft)]">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-5">
              <div className="flex items-center gap-2">
                <Logo size={22} />
                <span className="font-mono text-sm font-semibold">fluxo</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label={t("closeMenu")}
                className="rounded-md p-1.5 text-faint hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">{navList}</div>
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMenu={() => setMobileOpen(true)}
          menuButton={
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t("openMenu")}
              className="rounded-md p-1.5 text-muted hover:bg-[var(--surface-hover)] hover:text-fg lg:hidden"
            >
              <Menu size={18} />
            </button>
          }
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
