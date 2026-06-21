// Locale-aware date / relative-time / number formatting helpers.
// Pure functions; pass the active locale (from next-intl useLocale()).

type Locale = string;

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date + time, e.g. "Jun 22, 2026, 14:05". */
export function formatDateTime(value: string | number | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Date only, e.g. "Jun 22, 2026". */
export function formatDate(value: string | number | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

/** Time only, e.g. "14:05". */
export function formatTime(value: string | number | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(d);
}

const REL_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** Relative time, e.g. "3 minutes ago" / "in 2 days". */
export function formatRelative(value: string | number | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  if (!d) return "—";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (d.getTime() - Date.now()) / 1000; // seconds (negative = past)
  for (const division of REL_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "year");
}

/** Human duration from milliseconds, e.g. "820ms", "1.4s", "2m 5s". */
export function formatDuration(ms: number | null | undefined, locale: Locale): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1000) {
    return `${formatNumber(Math.round(ms), locale)}ms`;
  }
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    const s = Math.round(totalSeconds * 10) / 10;
    return `${formatNumber(s, locale)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/** Locale-aware number formatting. */
export function formatNumber(value: number | null | undefined, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, opts).format(value);
}

/** Percentage from a 0..1 ratio OR a 0..100 number — pass `ratio` accordingly. */
export function formatPercent(value: number | null | undefined, locale: Locale, isRatio = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const v = isRatio ? value : value / 100;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: v >= 0.1 ? 0 : 1,
  }).format(v);
}

/** Compact number, e.g. "1.2K". */
export function formatCompact(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
