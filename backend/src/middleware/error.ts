import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { t } from "../lib/i18n";
import { env } from "../lib/env";
import { toValidationError, FieldDetail } from "../lib/validate";

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: t(req.locale, "error.notFound"),
    },
  });
}

/** Central error handler — localizes AppError, Zod errors, and unknowns. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const locale = req.locale;

  // Zod errors thrown outside of validate() helper.
  if (err instanceof ZodError) {
    err = toValidationError(err);
  }

  if (err instanceof AppError) {
    const details = localizeDetails(err.details, locale);
    res.status(err.status).json({
      error: {
        code: err.code,
        message: t(locale, err.messageKey, err.vars),
        ...(details !== undefined ? { details } : {}),
      },
    });
    return;
  }

  // express.json() / body-parser errors (e.g. malformed JSON, payload too large).
  if (isBodyParserError(err)) {
    const e = err as { type?: string };
    const code = e.type === "entity.too.large" ? "VALIDATION" : "VALIDATION";
    res.status(400).json({
      error: {
        code,
        message: t(locale, "error.validation"),
      },
    });
    return;
  }

  // Unknown -> 500 INTERNAL. Log the raw error server-side only.
  // eslint-disable-next-line no-console
  console.error("[error] unhandled", err);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: t(locale, "error.internal"),
      ...(env.isProd ? {} : { details: serializeUnknown(err) }),
    },
  });
}

/** Localize per-field validation details (path + i18n key + vars). */
function localizeDetails(details: unknown, locale: string): unknown {
  if (Array.isArray(details) && details.every(isFieldDetail)) {
    return (details as FieldDetail[]).map((d) => ({
      path: d.path,
      message: t(locale, d.key, d.vars),
    }));
  }
  return details;
}

function isFieldDetail(v: unknown): v is FieldDetail {
  return (
    typeof v === "object" &&
    v !== null &&
    "path" in v &&
    "key" in v &&
    typeof (v as Record<string, unknown>).key === "string"
  );
}

function isBodyParserError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { type?: string; status?: number; statusCode?: number };
  return (
    e.type === "entity.parse.failed" ||
    e.type === "entity.too.large" ||
    e.type === "encoding.unsupported" ||
    e.type === "request.aborted"
  );
}

function serializeUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "unknown error";
  }
}
