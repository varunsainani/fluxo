import type { NodeHandler } from "./types";
import { asArray, asString } from "./types";

/**
 * action.if — config { combinator: "and"|"or", conditions: [{ left, operator, right }] }.
 * operators: eq neq contains notContains gt gte lt lte isEmpty isNotEmpty isTrue.
 * Output = input unchanged. Returns branch "true" | "false" for edge routing.
 */
export const actionIf: NodeHandler = async ({ config, input }) => {
  const combinator = asString(config.combinator, "and").toLowerCase() === "or" ? "or" : "and";
  const conditions = asArray<unknown>(config.conditions);

  let result: boolean;
  if (conditions.length === 0) {
    // No conditions -> treat as pass (true branch).
    result = true;
  } else if (combinator === "or") {
    result = conditions.some((c) => evalCondition(c));
  } else {
    result = conditions.every((c) => evalCondition(c));
  }

  return { output: input, branch: result ? "true" : "false" };
};

function evalCondition(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const cond = c as Record<string, unknown>;
  const left = cond.left;
  const right = cond.right;
  const operator = asString(cond.operator, "eq").trim();

  switch (operator) {
    case "eq":
      return looseEq(left, right);
    case "neq":
      return !looseEq(left, right);
    case "contains":
      return toStr(left).includes(toStr(right));
    case "notContains":
      return !toStr(left).includes(toStr(right));
    case "gt":
      return toNum(left) > toNum(right);
    case "gte":
      return toNum(left) >= toNum(right);
    case "lt":
      return toNum(left) < toNum(right);
    case "lte":
      return toNum(left) <= toNum(right);
    case "isEmpty":
      return isEmpty(left);
    case "isNotEmpty":
      return !isEmpty(left);
    case "isTrue":
      return isTruthy(left);
    default:
      return false;
  }
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Numeric comparison if both look numeric.
  const na = Number(a);
  const nb = Number(b);
  if (
    a !== "" &&
    b !== "" &&
    a !== null &&
    b !== null &&
    !Number.isNaN(na) &&
    !Number.isNaN(nb)
  ) {
    return na === nb;
  }
  return toStr(a) === toStr(b);
}

function toStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function isTruthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}
