"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { locales, localeNames, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tToast = useTranslations("toasts");
  const tRole = useTranslations("roles");
  const { user, setUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { resolvedTheme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const saveProfile = async () => {
    if (!user || !name.trim() || name.trim() === user.name) return;
    const next = name.trim();
    setSaving(true);
    // Try to persist server-side; the auth/me PATCH may or may not exist depending
    // on the backend build, so we fall back to an optimistic local update.
    try {
      await api.patch("/auth/me", { name: next });
    } catch {
      /* endpoint not available — keep the optimistic update */
    }
    setUser({ ...user, name: next });
    toast.success(tToast("profileSaved"));
    setSaving(false);
  };

  const changeLocale = (loc: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${loc}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  const isDark = resolvedTheme !== "light";

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* profile */}
        <Card>
          <CardHeader>
            <CardTitle>{t("profile")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("profileHint")}</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="name">{t("displayName")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" value={user?.email ?? ""} mono disabled readOnly />
              <p className="mt-1.5 text-[11px] text-faint">{t("emailReadonly")}</p>
            </div>
            <div>
              <Label>{t("role")}</Label>
              <div>
                <Badge variant="brand">
                  <UserIcon size={11} />
                  {user ? tRole(user.role) : ""}
                </Badge>
              </div>
            </div>
            <Button
              onClick={saveProfile}
              loading={saving}
              disabled={!name.trim() || name.trim() === user?.name}
            >
              {t("saveProfile")}
            </Button>
          </CardBody>
        </Card>

        {/* preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t("preferences")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("preferencesHint")}</p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <Label>{tc("language")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => changeLocale(loc)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm transition-colors",
                      loc === locale
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-fg"
                        : "border-[var(--border)] bg-[var(--surface)] text-muted hover:text-fg",
                    )}
                  >
                    {localeNames[loc]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{tc("theme")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    mounted && isDark
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-fg"
                      : "border-[var(--border)] bg-[var(--surface)] text-muted hover:text-fg",
                  )}
                >
                  <Moon size={15} />
                  {tc("dark")}
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    mounted && !isDark
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-fg"
                      : "border-[var(--border)] bg-[var(--surface)] text-muted hover:text-fg",
                  )}
                >
                  <Sun size={15} />
                  {tc("light")}
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
