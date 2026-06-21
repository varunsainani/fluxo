import type { NodeHandler } from "./types";
import { asArray, asString } from "./types";

/**
 * action.setFields — config { fields: [{ name, value }] }.
 * Output = object built from already-resolved field values (resolveDeep ran on config).
 */
export const actionSetFields: NodeHandler = async ({ config }) => {
  const out: Record<string, unknown> = {};
  for (const f of asArray<unknown>(config.fields)) {
    if (f && typeof f === "object") {
      const field = f as Record<string, unknown>;
      const name = asString(field.name).trim();
      if (name) out[name] = field.value;
    }
  }
  return { output: out };
};
