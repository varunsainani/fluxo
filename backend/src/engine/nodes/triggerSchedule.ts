import type { NodeHandler } from "./types";
import { asString, asObject } from "./types";

/**
 * trigger.schedule — config { cron, timezone, sample? }.
 * Output = { now: ISO, ...parsedSample }. `now` comes from the trigger input when the
 * scheduler supplies it (input.now), else $now.
 */
export const triggerSchedule: NodeHandler = async ({ config, input, ctx }) => {
  let now = ctx.$now;
  const inObj = asObject(input);
  if (typeof inObj.now === "string" && inObj.now) {
    now = inObj.now;
  }

  let parsedSample: Record<string, unknown> = {};
  const sample = asString(config.sample).trim();
  if (sample) {
    try {
      const parsed = JSON.parse(sample);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedSample = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed sample
    }
  }

  return { output: { now, ...parsedSample } };
};
