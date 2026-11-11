import { collections } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { sendSuccess } from "../utils/response.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALREADY_SUBSCRIBED = "You're already subscribed.";

/** POST /api/newsletter  { "email": "a@b.com" } */
export const subscribe = asyncHandler(async (req, res) => {
  const email = String((req.body as { email?: unknown } | undefined)?.email || "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, "Please enter a valid email address.");
  }

  const existing = await collections.subscribers.findOne({ email });

  if (existing) {
    throw new AppError(409, ALREADY_SUBSCRIBED);
  }

  try {
    await collections.subscribers.insertOne({ email, createdAt: new Date() });
  } catch (error) {
    // The unique index on email catches concurrent duplicate sign-ups.
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, ALREADY_SUBSCRIBED);
    }

    throw error;
  }

  sendSuccess(res, "Subscribed successfully!", { status: 201 });
}, "Failed to subscribe.");
