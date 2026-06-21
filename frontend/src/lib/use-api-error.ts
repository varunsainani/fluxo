"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "./types";

/**
 * Returns a function that turns any thrown value into a localized, user-facing
 * message. Prefers our error-code catalog; falls back to the server message.
 */
export function useApiError() {
  const t = useTranslations("errors");
  const tt = useTranslations("toasts");

  return useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        // Known codes have localized copy; otherwise show the server message.
        const known = [
          "VALIDATION",
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "CONFLICT",
          "WORKFLOW_INACTIVE",
          "RATE_LIMITED",
          "INTERNAL",
          "NETWORK",
        ];
        if (known.includes(err.code)) return t(err.code);
        if (err.message) return err.message;
      }
      return tt("genericError");
    },
    [t, tt],
  );
}
