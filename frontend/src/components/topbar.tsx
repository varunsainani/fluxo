"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      try {
        const { count } = await api.get<{ count: number }>("/notifications/unread-count");
        if (alive) setCount(count);
      } catch {
        /* ignore transient errors */
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);

  return count;
}

export function Topbar({
  menuButton,
}: {
  onOpenMenu?: () => void;
  menuButton?: React.ReactNode;
}) {
  const t = useTranslations("topbar");
  const tr = useTranslations("roles");
  const pathname = usePathname();
  const unread = useUnreadCount();

  // page title from the first path segment
  const tn = useTranslations("nav");
  const seg = pathname.split("/").filter(Boolean)[0] ?? "workflows";
  let title = seg;
  try {
    title = tn(seg);
  } catch {
    /* keep raw segment */
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2">
        {menuButton}
        <h1 className="font-mono text-sm font-semibold capitalize text-fg">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <LangToggle />
        <ThemeToggle />
        <NotificationsBell unread={unread} label={t("notifications")} />
        <UserMenu roleLabel={(role: string) => tr(role)} t={t} />
      </div>
    </header>
  );
}

function NotificationsBell({ unread, label }: { unread: number; label: string }) {
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-muted transition-colors hover:text-fg hover:bg-[var(--surface-hover)]"
    >
      <Bell size={16} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[color:var(--err)] px-1 font-mono text-[10px] font-semibold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

function UserMenu({
  roleLabel,
  t,
}: {
  roleLabel: (role: string) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const { user, logout } = useAuth();
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

  const onLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] pl-1.5 pr-2 transition-colors hover:bg-[var(--surface-hover)]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] font-mono text-[10px] font-semibold text-white">
          {initials}
        </span>
        <ChevronDown size={14} className="text-faint" />
      </button>

      {open && (
        <div className="animate-in absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] font-mono text-xs font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
                <p className="truncate font-mono text-[11px] text-faint">{user?.email}</p>
              </div>
            </div>
            {user && (
              <span className="mt-2 inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {roleLabel(user.role)}
              </span>
            )}
          </div>
          <div className="py-1">
            <MenuLink href="/settings" icon={UserIcon} label={t("profile")} onNavigate={() => setOpen(false)} />
            <MenuLink href="/settings" icon={Settings} label={t("account")} onNavigate={() => setOpen(false)} />
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--err)] transition-colors hover:bg-[var(--surface-hover)]",
              )}
            >
              <LogOut size={15} />
              {t("logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: typeof UserIcon;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted transition-colors hover:bg-[var(--surface-hover)] hover:text-fg"
    >
      <Icon size={15} />
      {label}
    </Link>
  );
}
