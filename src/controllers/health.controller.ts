import type { RequestHandler } from "express";
import { connectToMongoDB } from "../config/db.js";

/** GET /api/health - API and MongoDB liveness check. */
export const healthCheck: RequestHandler = async (_req, res) => {
  try {
    const db = await connectToMongoDB();
    await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "BookNook API and MongoDB are running.",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed.",
      database: "disconnected",
    });
  }
};
