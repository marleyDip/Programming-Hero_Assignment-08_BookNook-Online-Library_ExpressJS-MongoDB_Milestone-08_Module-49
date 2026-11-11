import type { Request } from "express";
import type { AuthUser } from "../types/index.js";
import { AppError } from "./AppError.js";

/** Returns the user attached by `verifyApi`, or throws 401. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user?.email) {
    throw new AppError(401, "Authenticated user email is unavailable.");
  }

  return req.user;
}
