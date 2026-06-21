import { z, ZodError, ZodIssue } from "zod";
import { AppError } from "./errors";

/**
 * Map a single Zod issue to a localized i18n key + vars. The error handler
 * resolves the key against req.locale, so messages stay language-neutral here.
 */
function issueToKey(issue: ZodIssue): { key: string; vars?: Record<string, unknown> } {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") {
        return { key: "validation.required" };
      }
      switch (issue.expected) {
        case "string":
          return { key: "validation.string" };
        case "number":
        case "integer":
          return { key: "validation.number" };
        case "boolean":
          return { key: "validation.boolean" };
        case "object":
          return { key: "validation.object" };
        case "array":
          return { key: "validation.array" };
        default:
          return { key: "validation.required" };
      }
    case "invalid_string":
      if (issue.validation === "email") return { key: "validation.email" };
      return { key: "validation.string" };
    case "too_small":
      if (issue.type === "string") {
        if (issue.minimum === 1) return { key: "validation.required" };
        return { key: "validation.minLength", vars: { min: Number(issue.minimum) } };
      }
      return { key: "validation.required" };
    case "too_big":
      if (issue.type === "string") {
        return { key: "validation.maxLength", vars: { max: Number(issue.maximum) } };
      }
      return { key: "validation.maxLength", vars: { max: Number(issue.maximum) } };
    case "invalid_enum_value":
      return { key: "validation.enum" };
    case "custom":
      return { key: issue.message || "error.validation" };
    default:
      return { key: "error.validation" };
  }
}

export interface FieldDetail {
  path: string;
  key: string;
  vars?: Record<string, unknown>;
}

/**
 * Parse `data` with `schema`. On failure throw AppError(VALIDATION) carrying
 * per-field details (path + i18n key + vars) for the error handler to localize.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw toValidationError(result.error);
}

export function toValidationError(error: ZodError): AppError {
  const details: FieldDetail[] = error.issues.map((issue) => {
    const { key, vars } = issueToKey(issue);
    return { path: issue.path.join("."), key, vars };
  });
  return new AppError(400, "VALIDATION", "error.validation", { details });
}

export { z };
