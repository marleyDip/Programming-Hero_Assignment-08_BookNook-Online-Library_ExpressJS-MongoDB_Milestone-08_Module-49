import type { Filter } from "mongodb";
import { collections } from "../config/db.js";
import {
  DEFAULT_CONDITION,
  DEFAULT_LANGUAGE,
  DEFAULT_SORT,
  LIMITS,
  SORT_OPTIONS,
} from "../constants/index.js";
import type { BookChanges, BookDocument } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseObjectId } from "../utils/objectId.js";
import { escapeRegex, parsePositiveInt, queryString } from "../utils/parse.js";
import { getAuthUser } from "../utils/request.js";
import { sendSuccess } from "../utils/response.js";
import { withTransaction } from "../utils/transaction.js";
import { validateBookInput } from "../validators/book.validator.js";

/**
 * GET /api/books?category=Fiction&search=dune&sort=title-asc&page=2&limit=10
 * Public. Filter, search, sort and paginate all books.
 */
export const getBooks = asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);

  const limit = Math.min(
    parsePositiveInt(req.query.limit, LIMITS.pageSizeDefault),
    LIMITS.pageSizeMax,
  );

  const category = queryString(req.query.category);
  const search = queryString(req.query.search);

  const sort =
    typeof req.query.sort === "string" ? req.query.sort : DEFAULT_SORT;

  if (search.length > LIMITS.search) {
    throw new AppError(400, "Search query is too long.");
  }

  const filter: Filter<BookDocument> = {};

  if (category) {
    filter.category = {
      $regex: `^${escapeRegex(category)}$`,
      $options: "i",
    };
  }

  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };

    filter.$or = [{ title: regex }, { author: regex }];
  }

  // Only predefined sort options are allowed.
  const sortBy = Object.hasOwn(SORT_OPTIONS, sort)
    ? SORT_OPTIONS[sort]
    : SORT_OPTIONS[DEFAULT_SORT];

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw new AppError(400, "Invalid pagination parameters.");
  }

  const [books, total] = await Promise.all([
    collections.books
      .find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .toArray(),

    collections.books.countDocuments(filter),
  ]);

  sendSuccess(res, "Books fetched successfully.", {
    data: {
      books,

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    },
  });
}, "Failed to fetch books.");

/** GET /api/books/latest - newest 8 books. Public. */
export const getLatestBooks = asyncHandler(async (_req, res) => {
  const books = await collections.books
    .find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(LIMITS.latestBooks)
    .toArray();

  sendSuccess(res, "Latest books fetched successfully.", { data: books });
}, "Failed to fetch latest books.");

/** GET /api/books/:id - single book (Book Details page). Auth required. */
export const getBookById = asyncHandler(async (req, res) => {
  const _id = parseObjectId(req.params.id, "book");

  const book = await collections.books.findOne({ _id });

  if (!book) {
    throw new AppError(404, "Book not found.");
  }

  sendSuccess(res, "Book fetched successfully.", { data: book });
}, "Failed to fetch book.");

/** POST /api/books - add a book owned by the authenticated user. */
export const createBook = asyncHandler(async (req, res) => {
  const input = validateBookInput(req.body, "create");
  const { email, name } = getAuthUser(req);

  const book: BookDocument = {
    title: input.title,
    author: input.author,
    category: input.category,
    image: input.image ?? "",
    description: input.description ?? "",
    totalCopies: input.totalCopies,
    availableCopies: input.totalCopies,
    isbn: input.isbn ?? "",
    publishedYear: input.publishedYear ?? null,
    language: input.language ?? DEFAULT_LANGUAGE,
    condition: input.condition ?? DEFAULT_CONDITION,
    ownerName: name,
    ownerEmail: email,
    // createdAt is what makes "newest" sorting work
    createdAt: new Date(),
  };

  const result = await collections.books.insertOne(book);

  sendSuccess(res, "Book added successfully.", {
    status: 201,
    data: { ...book, _id: result.insertedId },
  });
}, "Failed to add book.");

/** GET /api/my-books - books owned by the authenticated user. */
export const getMyBooks = asyncHandler(async (req, res) => {
  const { email } = getAuthUser(req);

  const books = await collections.books
    .find({ ownerEmail: email })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();

  sendSuccess(
    res,
    books.length ? "Your books fetched successfully." : "No books found.",
    { data: books, meta: { total: books.length } },
  );
}, "Failed to fetch your books.");

/** PUT /api/books/:id - update a book (owner only). */
export const updateBook = asyncHandler(async (req, res) => {
  const _id = parseObjectId(req.params.id, "book");

  const { email } = getAuthUser(req);

  const input = validateBookInput(req.body, "update");

  const book = await collections.books.findOne({ _id, ownerEmail: email });

  if (!book) {
    const exists = await collections.books.findOne(
      { _id },
      { projection: { _id: 1 } },
    );

    throw exists
      ? new AppError(403, "You can only edit your own books.")
      : new AppError(404, "Book not found.");
  }

  // Copies currently out on loan can't be removed from the total.
  const total = book.totalCopies ?? 1;
  const available = book.availableCopies ?? total;
  const borrowedNow = Math.max(0, total - available);

  if (input.totalCopies < borrowedNow) {
    throw new AppError(
      400,
      `${borrowedNow} copies are borrowed right now, so total copies cannot be less than ${borrowedNow}.`,
    );
  }

  // Fields the client omitted keep their stored value.
  const changes: BookChanges = {
    title: input.title,
    author: input.author,
    category: input.category,
    image: input.image ?? book.image ?? "",
    description: input.description ?? book.description ?? "",
    totalCopies: input.totalCopies,
    availableCopies: input.totalCopies - borrowedNow,
    isbn: input.isbn ?? book.isbn ?? "",
    publishedYear:
      input.publishedYear === undefined
        ? (book.publishedYear ?? null)
        : input.publishedYear,
    language: input.language ?? book.language ?? DEFAULT_LANGUAGE,
    condition: input.condition ?? book.condition ?? DEFAULT_CONDITION,
    updatedAt: new Date(),
  };

  // Atomic check: ownership and copy counts must be unchanged since we read them.
  const result = await collections.books.updateOne(
    {
      _id,
      ownerEmail: email,
      totalCopies: total,
      availableCopies: available,
      $expr: {
        $lte: [
          { $subtract: ["$totalCopies", "$availableCopies"] },
          input.totalCopies,
        ],
      },
    },
    { $set: changes },
  );

  if (result.matchedCount === 0) {
    throw new AppError(
      409,
      "Book data changed during the update. Please refresh and try again.",
    );
  }

  sendSuccess(res, "Book updated successfully.", {
    data: { ...book, ...changes, _id },
  });
}, "Failed to update book.");

/** DELETE /api/books/:id - delete a book (owner only, none currently borrowed). */
export const deleteBook = asyncHandler(async (req, res) => {
  const _id = parseObjectId(req.params.id, "book");

  const { email } = getAuthUser(req);

  await withTransaction(async (session) => {
    const book = await collections.books.findOne(
      { _id, ownerEmail: email },
      { session },
    );

    if (!book) {
      const exists = await collections.books.findOne(
        { _id },
        { projection: { _id: 1 }, session },
      );

      throw exists
        ? new AppError(403, "You can only delete your own books.")
        : new AppError(404, "Book not found.");
    }

    const activeBorrow = await collections.borrowings.findOne(
      { bookId: _id, status: "borrowed" },
      { projection: { _id: 1 }, session },
    );

    if (activeBorrow) {
      throw new AppError(
        409,
        "Some copies are currently borrowed. Return them before deleting this book.",
      );
    }

    const result = await collections.books.deleteOne(
      { _id, ownerEmail: email },
      { session },
    );

    if (result.deletedCount !== 1) {
      throw new Error("Book deletion failed.");
    }
  });

  sendSuccess(res, "Book deleted successfully.", {
    data: { _id: _id.toString() },
  });
}, "Failed to delete the book.");
