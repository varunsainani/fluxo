import type { NodeHandler } from "./types";
import { asString } from "./types";

/**
 * trigger.webhook — config { sample?: string }.
 * Output = the posted body (passed as input). A manual run with no body uses the sample.
 */
export const triggerWebhook: NodeHandler = async ({ config, input }) => {
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
      // fall through
    }
  }
  // Preserve a provided (possibly empty) input object over {}.
  return { output: input ?? {} };
};
