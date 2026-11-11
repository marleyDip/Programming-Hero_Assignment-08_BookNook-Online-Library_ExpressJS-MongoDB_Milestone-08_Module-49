import { Router } from "express";
import { subscribe } from "../controllers/newsletter.controller.js";

/** Mounted at /api/newsletter */
export const newsletterRouter = Router();

newsletterRouter.post("/", subscribe);
