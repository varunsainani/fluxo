"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
