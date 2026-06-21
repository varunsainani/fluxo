"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, User, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApiError } from "@/lib/use-api-error";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { HeroGraph } from "@/components/hero-graph";

type Mode = "login" | "register";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login, register, demoLogin } = useAuth();
  const toApiError = useApiError();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState<"user" | "admin" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goApp = () => router.push("/workflows");

  const onDemo = async (role: "user" | "admin") => {
    setError(null);
    setDemoBusy(role);
    try {
      await demoLogin(role);
      goApp();
    } catch (e) {
      setError(toApiError(e));
      setDemoBusy(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      goApp();
    } catch (err) {
      setError(toApiError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* form side */}
      <div className="relative flex flex-col bg-base">
        <div className="flex items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-mono text-sm font-semibold">fluxo</span>
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? t("loginTitle") : t("registerTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
            </p>

            {/* one-click demo */}
            <div className="mt-7">
              <div className="mb-1 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                {t("demoSectionTitle")}
              </div>
              <p className="mb-3 text-xs text-faint">{t("demoSectionHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => onDemo("user")}
                  loading={demoBusy === "user"}
                  disabled={demoBusy !== null}
                >
                  <User size={15} />
                  {t("enterAsUser")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDemo("admin")}
                  loading={demoBusy === "admin"}
                  disabled={demoBusy !== null}
                >
                  <Shield size={15} />
                  {t("enterAsAdmin")}
                </Button>
              </div>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-faint">
                {t("orDivider")}
              </span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    autoComplete="name"
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="rounded-md border border-[color:var(--err)]/30 bg-[color:var(--err)]/10 px-3 py-2 text-sm text-[color:var(--err)]">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" loading={submitting} disabled={demoBusy !== null}>
                {mode === "login"
                  ? submitting
                    ? t("signingIn")
                    : t("signInButton")
                  : t("createButton")}
                {!submitting && <ArrowRight size={16} />}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted">
              {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="font-medium text-[var(--primary)] hover:underline"
              >
                {mode === "login" ? t("switchToRegister") : t("switchToLogin")}
              </button>
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-muted"
            >
              <ArrowLeft size={13} />
              {t("backToHome")}
            </Link>
          </div>
        </div>
      </div>

      {/* art side */}
      <div className="relative hidden items-center justify-center overflow-hidden border-l border-[var(--border)] bg-blueprint p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_60%_40%,var(--glow),transparent_65%)]" />
        <div className="relative w-full max-w-md">
          <HeroGraph />
        </div>
      </div>
    </div>
  );
}
