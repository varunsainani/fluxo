import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap an async route handler so rejected promises are forwarded to Express's
 * error handler (Express 4 does not catch async rejections automatically).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
