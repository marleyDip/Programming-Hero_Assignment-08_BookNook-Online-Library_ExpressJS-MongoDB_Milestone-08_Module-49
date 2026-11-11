import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";

/** Mounted at /api/health */
export const healthRouter = Router();

healthRouter.get("/", healthCheck);
