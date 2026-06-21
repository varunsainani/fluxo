import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Terminal,
  Zap,
  Boxes,
  Braces,
  ScrollText,
  Database,
  Moon,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { HeroGraph } from "@/components/hero-graph";
import { Logo } from "@/components/logo";
import { nodeIcon, ALL_NODE_KINDS } from "@/lib/node-meta";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tn = await getTranslations("nodeKinds");
  const td = await getTranslations("nodeKindsDesc");

  const features = [
    { Icon: Zap, title: t("feature1Title"), body: t("feature1Body") },
    { Icon: Boxes, title: t("feature2Title"), body: t("feature2Body") },
    { Icon: Braces, title: t("feature3Title"), body: t("feature3Body") },
    { Icon: ScrollText, title: t("feature4Title"), body: t("feature4Body") },
    { Icon: Database, title: t("feature5Title"), body: t("feature5Body") },
    { Icon: Moon, title: t("feature6Title"), body: t("feature6Body") },
  ];

  const engineSteps = [
    t("engineStep1"),
    t("engineStep2"),
    t("engineStep3"),
    t("engineStep4"),
    t("engineStep5"),
  ];

  return (
    <div className="min-h-screen bg-base">
      <PublicHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-blueprint">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_-10%,var(--glow),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--signal)] animate-pulse-rail" />
              {t("heroBadge")}
            </div>

            <div className="mt-5 flex items-center gap-2 font-mono text-sm text-[var(--primary)]">
              <Terminal size={15} />
              <span className="text-faint">$</span>
              <span>{t("heroPrompt")}</span>
              <span className="ml-0.5 inline-block h-4 w-2 bg-[var(--primary)] animate-pulse-rail" />
            </div>

            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              {t("heroTitle")}
              <br />
              <span className="text-gradient">{t("heroTitleAccent")}</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{t("heroLead")}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] px-6 text-sm font-medium text-white transition-all hover:brightness-110 hover:glow-ring"
              >
                {t("heroCtaPrimary")}
                <ArrowRight size={16} />
              </Link>
              <a
                href="#engine"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-medium text-fg transition-colors hover:border-[var(--primary)]"
              >
                {t("heroCtaSecondary")}
              </a>
            </div>
          </div>

          <div className="lg:pl-4">
            <HeroGraph />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("featuresTitle")}</h2>
          <p className="mt-3 text-muted">{t("featuresLead")}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)] transition-colors group-hover:glow-ring">
                <Icon size={18} />
              </div>
              <h3 className="font-mono text-sm font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NODES */}
      <section id="nodes" className="border-y border-[var(--border)] bg-grid">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("nodesTitle")}</h2>
            <p className="mt-3 text-muted">{t("nodesLead")}</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {ALL_NODE_KINDS.map((kind) => {
              const Icon = nodeIcon(kind);
              const trigger = kind.startsWith("trigger.");
              return (
                <div
                  key={kind}
                  className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3.5"
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-l-2"
                    style={{
                      borderColor: trigger ? "var(--primary)" : "var(--signal)",
                      background: "var(--surface-2)",
                      color: trigger ? "var(--primary)" : "var(--signal)",
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-fg">{tn(kind)}</div>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{td(kind)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ENGINE */}
      <section id="engine" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("engineTitle")}</h2>
            <ol className="mt-8 space-y-4">
              {engineSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] font-mono text-xs font-semibold text-[var(--primary)]">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-fg">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-5">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-faint">
              node_run #4 · action.if
            </div>
            <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 font-mono text-[12.5px] leading-relaxed text-fg">
              <code>{`{
  "status": "SUCCESS",
  "input":  { "email": "ada@fluxo.app" },
  "config": {
    "combinator": "and",
    "conditions": [
      { "left": "{{ $json.email }}",
        "operator": "isNotEmpty" }
    ]
  },
  "branch": "true",
  "durationMs": 3
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-blueprint">
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,var(--glow),transparent_70%)] opacity-50" />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted">{t("ctaLead")}</p>
            <Link
              href="/login"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-[linear-gradient(100deg,var(--primary-strong),var(--accent))] px-7 text-sm font-medium text-white transition-all hover:brightness-110 hover:glow-ring"
            >
              {t("ctaButton")}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="font-mono text-xs text-muted">{t("footerNote")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
