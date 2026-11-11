import type { ClientSession } from "mongodb";
import { client } from "../config/db.js";

/**
 * Runs `work` inside a MongoDB transaction and returns its result.
 *
 * - Throwing (e.g. an AppError) aborts the transaction and rethrows the error.
 * - The session is always ended.
 * - `work` may run more than once on transient errors, so keep it free of
 *   side effects outside the database.
 */
export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = client.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = undefined; // reset in case the callback is retried
      result = await work(session);
    });

    return result as T;
  } finally {
    await session.endSession();
  }
}
