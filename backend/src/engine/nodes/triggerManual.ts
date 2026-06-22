import type { NodeHandler } from "./types";
import { asString } from "./types";

/**
 * trigger.manual — config { sample?: string (JSON) }.
 * Output = the trigger input when provided (manual run passes it in), else the
 * parsed `sample`, else `{}`.
 */
export const triggerManual: NodeHandler = async ({ config, input }) => {
  const hasInput =
    input !== undefined &&
    input !== null &&
    !(typeof input === "object" && !Array.isArray(input) && Object.keys(input as object).length === 0);

  if (hasInput) {
    return { output: input };
  }

  const sample = asString(config.sample).trim();
  if (sample) {
    try {
      return { output: JSON.parse(sample) };
    } catch {
      // fall through to {}
    }
  }
  return { output: {} };
};
