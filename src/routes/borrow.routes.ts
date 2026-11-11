import { Router } from "express";
import {
  borrowBook,
  getMyBorrows,
  returnBook,
} from "../controllers/borrow.controller.js";
import { verifyApi } from "../middlewares/auth.middleware.js";

/** Mounted at /api/borrows. Every route requires authentication. */
export const borrowRouter = Router();

borrowRouter.use(verifyApi);

borrowRouter.post("/", borrowBook);

borrowRouter.get("/", getMyBorrows);

borrowRouter.patch("/:id/return", returnBook);
