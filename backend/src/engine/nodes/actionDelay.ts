import type { NodeHandler } from "./types";
import { asNumber } from "./types";

/**
 * action.delay — config { seconds: number }. Awaits min(seconds, 5) (serverless cap).
 * Output = input unchanged.
 */
export const actionDelay: NodeHandler = async ({ config, input }) => {
  const seconds = Math.max(0, asNumber(config.seconds, 0));
  const capped = Math.min(seconds, 5);
  if (capped > 0) {
    await new Promise((resolve) => setTimeout(resolve, capped * 1000));
  }
  return { output: input };
};
