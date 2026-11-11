import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { BORROW_DAYS, DAY_MS, LIMITS } from "../constants/index.js";
import type { BorrowingDocument } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { parseObjectId } from "../utils/objectId.js";
import { getAuthUser } from "../utils/request.js";
import { sendSuccess } from "../utils/response.js";
import { withTransaction } from "../utils/transaction.js";

const ALREADY_BORROWED = "You have already borrowed this book.";

/** POST /api/borrows  { bookId } - borrow one copy of a book. */
export const borrowBook = asyncHandler(async (req, res) => {
  const { bookId } = (req.body ?? {}) as { bookId?: unknown };

  if (typeof bookId !== "string" || !ObjectId.isValid(bookId)) {
    throw new AppError(400, "A valid bookId is required.");
  }

  const { email, name } = getAuthUser(req);

  if (name.length > LIMITS.userName) {
    throw new AppError(
      400,
      `User name must not exceed ${LIMITS.userName} characters.`,
    );
  }

  const _id = new ObjectId(bookId);

  try {
    const borrowing = await withTransaction(async (session) => {
      const book = await collections.books.findOne({ _id }, { session });

      if (!book) {
        throw new AppError(404, "Book not found.");
      }

      if (book.ownerEmail === email) {
        throw new AppError(400, "You can't borrow your own book.");
      }

      const alreadyBorrowed = await collections.borrowings.findOne(
        { bookId: _id, userEmail: email, status: "borrowed" },
        { projection: { _id: 1 }, session },
      );

      if (alreadyBorrowed) {
        throw new AppError(409, ALREADY_BORROWED);
      }

      // Atomically take one copy; fails if none are left.
      const updateResult = await collections.books.updateOne(
        { _id, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1 } },
        { session },
      );

      if (updateResult.modifiedCount !== 1) {
        throw new AppError(409, "No copies are available right now.");
      }

      const now = new Date();

      const record: BorrowingDocument = {
        bookId: _id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookImage: book.image,
        userEmail: email,
        userName: name,
        borrowDate: now,
        returnDate: new Date(now.getTime() + BORROW_DAYS * DAY_MS),
        returnedAt: null,
        status: "borrowed",
      };

      const result = await collections.borrowings.insertOne(record, {
        session,
      });

      return {
        _id: result.insertedId,
        bookId,
        returnDate: record.returnDate,
        status: record.status,
      };
    });

    sendSuccess(
      res,
      `Borrowed successfully! Please return it within ${BORROW_DAYS} days.`,
      { status: 201, data: borrowing },
    );
  } catch (error) {
    // Unique index on (bookId, userEmail) for active borrowings caught a race.
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, ALREADY_BORROWED);
    }

    throw error;
  }
}, "Failed to borrow the book.");

/** GET /api/borrows - the authenticated user's borrowing history. */
export const getMyBorrows = asyncHandler(async (req, res) => {
  const { email } = getAuthUser(req);

  const borrows = await collections.borrowings
    .find({ userEmail: email })
    .sort({ borrowDate: -1, _id: -1 })
    .toArray();

  sendSuccess(
    res,
    borrows.length
      ? "Your borrowing records fetched successfully."
      : "No borrowing records found.",
    { data: borrows, meta: { total: borrows.length } },
  );
}, "Failed to fetch your borrowing records.");

/** PATCH /api/borrows/:id/return - return a borrowed book. */
export const returnBook = asyncHandler(async (req, res) => {
  const _id = parseObjectId(req.params.id, "borrowing");
  const { email } = getAuthUser(req);

  const returned = await withTransaction(async (session) => {
    const borrow = await collections.borrowings.findOne(
      { _id, userEmail: email, status: "borrowed" },
      { session },
    );

    if (!borrow) {
      throw new AppError(404, "Active borrowing not found.");
    }

    // Give the copy back, but never beyond totalCopies.
    const bookResult = await collections.books.updateOne(
      {
        _id: borrow.bookId,
        $expr: { $lt: ["$availableCopies", "$totalCopies"] },
      },
      { $inc: { availableCopies: 1 } },
      { session },
    );

    // Abort if the book is missing or stock is inconsistent.
    if (bookResult.modifiedCount !== 1) {
      throw new Error(
        "Book not found or available copies are already at maximum.",
      );
    }

    const returnedAt = new Date();

    const borrowResult = await collections.borrowings.updateOne(
      { _id, userEmail: email, status: "borrowed" },
      { $set: { status: "returned", returnedAt } },
      { session },
    );

    if (borrowResult.modifiedCount !== 1) {
      throw new Error("Borrowing status changed unexpectedly.");
    }

    return {
      _id: _id.toString(),
      bookId: borrow.bookId,
      status: "returned" as const,
      returnedAt,
    };
  });

  sendSuccess(res, "Book returned successfully. Thank you!", {
    data: returned,
  });
}, "Failed to return the book.");
