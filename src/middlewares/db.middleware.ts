import type { RequestHandler } from "express";
import { connectToMongoDB } from "../config/db.js";
import { AppError } from "../utils/AppError.js";

/** Ensures the (cached) MongoDB connection is ready before any route runs. */
export const ensureDbConnection: RequestHandler = async (_req, _res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    next(new AppError(503, "Database connection failed.", { cause: error }));
  }
};
