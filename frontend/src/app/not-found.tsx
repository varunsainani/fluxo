import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blueprint px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_40%,var(--glow),transparent_70%)] opacity-40" />
      <div className="relative">
        <Logo size={40} className="mx-auto" />
        <p className="mt-6 font-mono text-6xl font-bold text-gradient">{t("code")}</p>
        <h1 className="mt-4 text-xl font-semibold text-fg">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("body")}</p>
        <Link
          href="/"
          className="mt-7 inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium text-fg transition-colors hover:border-[var(--primary)]"
        >
          <ArrowLeft size={15} />
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
