import type { Response } from "express";

interface SuccessOptions<T> {
  status?: number;
  data?: T;
  /** Extra top-level fields, e.g. `{ total }`. */
  meta?: Record<string, unknown>;
}

export function sendSuccess<T = undefined>(
  res: Response,
  message: string,
  { status = 200, data, meta }: SuccessOptions<T> = {},
): void {
  res.status(status).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    ...meta,
  });
}
