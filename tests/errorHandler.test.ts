import { describe, it, expect, vi } from "vitest";
import { ApiError, errorHandler, notFoundHandler } from "../server/errorHandler";
import type { Request, Response, NextFunction } from "express";

/**
 * Phase 3.9 — Error handler.
 *
 * Pins the JSON shape `{ error: { code, message, details? } }` and the
 * status mapping from ApiError + raw error objects.
 */

function mkRes() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return res as Response;
}

describe("ApiError", () => {
  it("carries status, code, message, and optional details", () => {
    const e = new ApiError(403, "forbidden", "nope", { foo: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(403);
    expect(e.code).toBe("forbidden");
    expect(e.message).toBe("nope");
    expect(e.details).toEqual({ foo: 1 });
  });
});

describe("notFoundHandler", () => {
  it("returns 404 with the canonical error shape", () => {
    const res = mkRes();
    notFoundHandler({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "not_found", message: "Endpoint not found" }
    });
  });
});

describe("errorHandler", () => {
  it("returns ApiError status + structured JSON", () => {
    const res = mkRes();
    const err = new ApiError(400, "bad_input", "missing field", { field: "round" });
    errorHandler(err, {} as Request, res, {} as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "bad_input", message: "missing field", details: { field: "round" } }
    });
  });

  it("defaults to 500 + internal_error for plain errors", () => {
    const res = mkRes();
    errorHandler(new Error("oh no"), {} as Request, res, {} as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "internal_error", message: "oh no" }
    });
  });

  it("defaults to 500 + internal_error for non-Error throws", () => {
    const res = mkRes();
    errorHandler("string throw", {} as Request, res, {} as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "internal_error", message: "Unexpected server error" }
    });
  });
});
