import type { ObjectId } from "mongodb";
import type { Category, Condition } from "../constants/index.js";

export interface BookDocument {
  _id?: ObjectId;
  title: string;
  author: string;
  category: Category;
  image: string;
  description: string;
  totalCopies: number;
  availableCopies: number;
  isbn: string;
  publishedYear: number | null;
  language: string;
  condition: Condition;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** Fields an owner is allowed to change on an existing book. */
export type BookChanges = Pick<
  BookDocument,
  | "title"
  | "author"
  | "category"
  | "image"
  | "description"
  | "totalCopies"
  | "availableCopies"
  | "isbn"
  | "publishedYear"
  | "language"
  | "condition"
> & { updatedAt: Date };

export type BorrowStatus = "borrowed" | "returned";

export interface BorrowingDocument {
  _id?: ObjectId;
  bookId: ObjectId;
  bookTitle: string;
  bookAuthor: string;
  bookImage: string;
  userEmail: string;
  userName: string;
  borrowDate: Date;
  returnDate: Date;
  returnedAt: Date | null;
  status: BorrowStatus;
}

export interface SubscriberDocument {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
}

/** Verified identity extracted from the Better Auth JWT. */
export interface AuthUser {
  id?: string;
  email: string;
  name: string;
}
