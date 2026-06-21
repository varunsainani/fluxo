import { Request, Response, NextFunction } from "express";
import { isLocale, Locale } from "../lib/i18n";

/**
 * Resolve the request locale: X-Locale header (en|es|pt) -> Accept-Language ->
 * "en". Mounted BEFORE express.json() so body-parser errors are still localized.
 */
export function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.locale = resolveLocale(req);
  next();
}

function resolveLocale(req: Request): Locale {
  const header = req.headers["x-locale"];
  const xLocale = (Array.isArray(header) ? header[0] : header)?.trim().toLowerCase();
  if (xLocale && isLocale(xLocale)) return xLocale;

  const accept = req.headers["accept-language"];
  const acceptStr: string | undefined = Array.isArray(accept) ? accept[0] : accept;
  if (acceptStr) {
    // Parse "pt-BR,pt;q=0.9,en;q=0.8" -> first matching base locale.
    const langs = acceptStr
      .split(",")
      .map((part: string) => part.split(";")[0].trim().toLowerCase())
      .filter(Boolean);
    for (const lang of langs) {
      const base = lang.split("-")[0];
      if (isLocale(base)) return base;
    }
  }

  return "en";
}
