import { Router } from "express";
import { bookRouter, myBooksRouter } from "./book.routes.js";
import { borrowRouter } from "./borrow.routes.js";
import { healthRouter } from "./health.routes.js";
import { newsletterRouter } from "./newsletter.routes.js";

/** Mounted at /api */
export const apiRouter = Router();

apiRouter.use("/books", bookRouter);

apiRouter.use("/my-books", myBooksRouter);

apiRouter.use("/borrows", borrowRouter);

apiRouter.use("/newsletter", newsletterRouter);

apiRouter.use("/health", healthRouter);
