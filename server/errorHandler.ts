import type { Request, Response, NextFunction } from "express";

/**
 * Uniform JSON error response: `{ error: { code, message, ... } }`.
 *
 * Maps 4xx/5xx via the `status` property on the error (or a default
 * of 500). Logs to console; doesn't print full payloads in production
 * to avoid leaking telemetry names.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "not_found", message: "Endpoint not found" } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }
    });
    return;
  }
  const e = err as { status?: number; code?: string; message?: string };
  const status = typeof e?.status === "number" ? e.status : 500;
  const code = e?.code ?? "internal_error";
  const message = e?.message ?? "Unexpected server error";
  // eslint-disable-next-line no-console
  console.error("[error]", status, code, message);
  res.status(status).json({ error: { code, message } });
}
