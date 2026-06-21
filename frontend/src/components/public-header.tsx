"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export function PublicHeader() {
  const t = useTranslations("landing");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={22} />
          <span className="font-mono text-sm font-semibold tracking-tight">fluxo</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-muted transition-colors hover:text-fg">
            {t("navFeatures")}
          </a>
          <a href="#nodes" className="text-sm text-muted transition-colors hover:text-fg">
            {t("navNodes")}
          </a>
          <a href="#engine" className="text-sm text-muted transition-colors hover:text-fg">
            {t("navEngine")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="ml-1 inline-flex h-9 items-center rounded-md bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] px-4 text-sm font-medium text-white transition-all hover:brightness-110 hover:glow-ring"
          >
            {t("launchApp")}
          </Link>
        </div>
      </div>
    </header>
  );
}
