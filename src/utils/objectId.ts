import { ObjectId } from "mongodb";
import { AppError } from "./AppError.js";

/** Parses a route param into an ObjectId or throws a 400 ("Invalid book ID."). */
export function parseObjectId(value: unknown, label: string): ObjectId {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new AppError(400, `Invalid ${label} ID.`);
  }

  return new ObjectId(value);
}
