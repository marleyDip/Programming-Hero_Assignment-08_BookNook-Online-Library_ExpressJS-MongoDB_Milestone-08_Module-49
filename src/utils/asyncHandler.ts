import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "./AppError.js";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Wraps an async controller so rejected promises reach the error middleware.
 *
 * Expected failures should `throw new AppError(...)`. Any other error is
 * logged by the error middleware and returned as a 500 with `fallbackMessage`.
 */
export const asyncHandler =
  (
    handler: AsyncRequestHandler,
    fallbackMessage = "Internal server error.",
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error: unknown) => {
      next(
        error instanceof AppError
          ? error
          : new AppError(500, fallbackMessage, { cause: error }),
      );
    });
  };
