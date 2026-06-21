import { parseExpression } from "cron-parser";

/**
 * Compute the next run time for a cron expression in a timezone, after `from`.
 * Returns null if the expression is invalid.
 */
export function computeNextRunAt(cron: string, timezone: string, from: Date = new Date()): Date | null {
  try {
    const interval = parseExpression(cron, { currentDate: from, tz: timezone || "UTC" });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/** Validate a cron expression string. */
export function isValidCron(cron: string, timezone = "UTC"): boolean {
  try {
    parseExpression(cron, { tz: timezone || "UTC" });
    return true;
  } catch {
    return false;
  }
}
