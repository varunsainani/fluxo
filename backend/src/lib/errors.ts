// Application error codes — must match SPEC §7 and frontend ApiError usage.
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "WORKFLOW_INACTIVE"
  | "RATE_LIMITED"
  | "INTERNAL";

/**
 * AppError carries an HTTP status, a stable machine code, a message *key*
 * (resolved/localized at the error-handler boundary), optional template vars
 * and optional structured details.
 */
export class AppError extends Error {
  status: number;
  code: ErrorCode;
  /** i18n key used to localize the message in the error handler. */
  messageKey: string;
  /** Variables interpolated into the localized message. */
  vars?: Record<string, unknown>;
  details?: unknown;

  constructor(
    status: number,
    code: ErrorCode,
    messageKey: string,
    opts?: { vars?: Record<string, unknown>; details?: unknown }
  ) {
    super(messageKey);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.vars = opts?.vars;
    this.details = opts?.details;
  }
}

type Opts = { vars?: Record<string, unknown>; details?: unknown };

export function badRequest(code: ErrorCode, messageKey: string, opts?: Opts) {
  return new AppError(400, code, messageKey, opts);
}

export function validationError(messageKey = "error.validation", opts?: Opts) {
  return new AppError(400, "VALIDATION", messageKey, opts);
}

export function unauthorized(messageKey = "error.unauthorized", opts?: Opts) {
  return new AppError(401, "UNAUTHORIZED", messageKey, opts);
}

export function forbidden(messageKey = "error.forbidden", opts?: Opts) {
  return new AppError(403, "FORBIDDEN", messageKey, opts);
}

export function notFound(messageKey = "error.notFound", opts?: Opts) {
  return new AppError(404, "NOT_FOUND", messageKey, opts);
}

export function conflict(messageKey = "error.conflict", opts?: Opts) {
  return new AppError(409, "CONFLICT", messageKey, opts);
}

export function workflowInactive(messageKey = "error.workflowInactive", opts?: Opts) {
  return new AppError(404, "WORKFLOW_INACTIVE", messageKey, opts);
}

export function rateLimited(messageKey = "error.rateLimited", opts?: Opts) {
  return new AppError(429, "RATE_LIMITED", messageKey, opts);
}

export function internal(messageKey = "error.internal", opts?: Opts) {
  return new AppError(500, "INTERNAL", messageKey, opts);
}
