import {
  CATEGORIES,
  CONDITIONS,
  LIMITS,
  type Category,
  type Condition,
} from "../constants/index.js";
import { AppError } from "../utils/AppError.js";
import { optionalString } from "../utils/parse.js";

export type BookInputMode = "create" | "update";

/**
 * Validated book payload. Optional fields are `undefined` when the client
 * did not send them, so callers can apply defaults (create) or keep the
 * stored value (update).
 */
export interface BookInput {
  title: string;
  author: string;
  category: Category;
  totalCopies: number;
  image?: string;
  description?: string;
  isbn?: string;
  language?: string;
  publishedYear?: number | null;
  condition?: Condition;
}

const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

const isCondition = (value: unknown): value is Condition =>
  typeof value === "string" &&
  (CONDITIONS as readonly string[]).includes(value);

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === "";

export function validateBookInput(
  body: unknown,
  mode: BookInputMode,
): BookInput {
  const data = (
    body !== null && typeof body === "object" ? body : {}
  ) as Record<string, unknown>;

  const {
    title,
    author,
    category,
    image,
    description,
    totalCopies,
    isbn,
    publishedYear,
    language,
    condition,
  } = data;

  // 1. Required fields
  const missingFields = Object.entries({ title, author, category })
    .filter(([, value]) => typeof value !== "string" || !value.trim())
    .map(([key]) => key);

  if (missingFields.length > 0) {
    throw mode === "create"
      ? new AppError(400, "Please provide all required fields.", {
          errors: missingFields,
        })
      : new AppError(400, "Title, author and category are required.");
  }

  const normalizedTitle = (title as string).trim();
  const normalizedAuthor = (author as string).trim();
  const normalizedCategory = (category as string).trim();

  // 2. Lengths
  if (
    normalizedTitle.length > LIMITS.title ||
    normalizedAuthor.length > LIMITS.author
  ) {
    throw new AppError(400, "Title or author exceeds the allowed length.");
  }

  // 3. Category
  if (!isCategory(normalizedCategory)) {
    throw new AppError(400, "Invalid book category.");
  }

  // 4. Total copies
  const copies = Number(totalCopies);

  if (
    isBlank(totalCopies) ||
    !Number.isInteger(copies) ||
    copies < LIMITS.copiesMin ||
    copies > LIMITS.copiesMax
  ) {
    throw new AppError(
      400,
      `Total copies must be between ${LIMITS.copiesMin} and ${LIMITS.copiesMax}.`,
    );
  }

  // 5. Publication year (undefined = not sent, null = cleared)
  let year: number | null | undefined;

  if (publishedYear === undefined) {
    year = undefined;
  } else if (isBlank(publishedYear)) {
    year = null;
  } else {
    year = Number(publishedYear);

    if (
      !Number.isInteger(year) ||
      year < LIMITS.yearMin ||
      year > new Date().getFullYear() + 1
    ) {
      throw new AppError(400, "Please enter a valid publication year.");
    }
  }

  // 6. Optional strings
  const invalidOptionalMessage =
    mode === "create"
      ? "One or more optional fields have invalid values or exceed their allowed length."
      : "One or more optional fields are invalid or too long.";

  const parseOptional = (
    value: unknown,
    maxLength: number,
    fallback = "",
  ): string | undefined => {
    if (value === undefined) return undefined;

    const parsed = optionalString(value, maxLength, fallback);

    if (parsed === null) {
      throw new AppError(400, invalidOptionalMessage);
    }

    return parsed;
  };

  const normalizedImage = parseOptional(image, LIMITS.image);

  const normalizedDescription = parseOptional(description, LIMITS.description);

  const normalizedIsbn = parseOptional(isbn, LIMITS.isbn);

  const normalizedLanguage = parseOptional(
    language,
    LIMITS.language,
    "English",
  );

  // 7. Cover image is mandatory when creating a book
  if (mode === "create" && !normalizedImage) {
    throw new AppError(400, "Book cover image is required.");
  }

  // 8. Condition (blank = not sent)
  let normalizedCondition: Condition | undefined;

  if (!isBlank(condition)) {
    if (!isCondition(condition)) {
      throw new AppError(400, "Invalid book condition.");
    }

    normalizedCondition = condition;
  }

  return {
    title: normalizedTitle,
    author: normalizedAuthor,
    category: normalizedCategory,
    totalCopies: copies,
    image: normalizedImage,
    description: normalizedDescription,
    isbn: normalizedIsbn,
    language: normalizedLanguage,
    publishedYear: year,
    condition: normalizedCondition,
  };
}
