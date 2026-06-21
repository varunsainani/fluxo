import type { NodeHandler } from "./types";
import { asString } from "./types";
import { resolveExpr } from "../expr";

/**
 * action.code — config { template: string } where template is a JSON document with
 * {{ expr }} placeholders. Placeholders are resolved (§8) and the result is JSON.parsed.
 * NO eval / Function. Parse failure -> node ERROR.
 *
 * Note: the executor resolves config via resolveDeep first; we resolve again here against
 * the live ctx to be robust either way (idempotent if no tokens remain).
 */
export const actionCode: NodeHandler = async ({ config, ctx }) => {
  const template = asString(config.template).trim();
  if (!template) {
    throw new Error("action.code: empty template");
  }

  // The template is a string that, after expression substitution, must be valid JSON.
  const resolved = resolveExpr(template, ctx);

  // If resolveExpr returned a non-string (whole-token typed value), use it directly when
  // it is already a JSON-compatible value; otherwise re-stringify.
  let toParse: string;
  if (typeof resolved === "string") {
    toParse = resolved;
  } else {
    // A whole-token expression produced a typed value — treat that as the output directly.
    return { output: resolved };
  }

  try {
    return { output: JSON.parse(toParse) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`action.code: template did not resolve to valid JSON (${msg})`);
  }
};
