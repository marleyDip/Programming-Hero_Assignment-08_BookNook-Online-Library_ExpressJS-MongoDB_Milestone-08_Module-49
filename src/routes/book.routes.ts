import { Router } from "express";
import {
  createBook,
  deleteBook,
  getBookById,
  getBooks,
  getLatestBooks,
  getMyBooks,
  updateBook,
} from "../controllers/book.controller.js";
import { verifyApi } from "../middlewares/auth.middleware.js";

/** Mounted at /api/books */
export const bookRouter = Router();

bookRouter.get("/", getBooks);

// IMPORTANT: keep "/latest" above "/:id" so it isn't treated as an id.
bookRouter.get("/latest", getLatestBooks);

bookRouter.get("/:id", verifyApi, getBookById);

bookRouter.post("/", verifyApi, createBook);

bookRouter.put("/:id", verifyApi, updateBook);

bookRouter.delete("/:id", verifyApi, deleteBook);

/** Mounted at /api/my-books */
export const myBooksRouter = Router();

myBooksRouter.get("/", verifyApi, getMyBooks);
