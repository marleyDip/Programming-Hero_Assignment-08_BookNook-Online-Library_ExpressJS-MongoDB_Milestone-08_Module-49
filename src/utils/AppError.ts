export interface AppErrorOptions {
  /** Field names or messages describing what was wrong with the request. */
  errors?: string[];
  cause?: unknown;
}

/**
 * An error with an HTTP status that is safe to show to API clients.
 * Anything that is not an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: string[];

  constructor(
    statusCode: number,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });

    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = options.errors;
  }
}
