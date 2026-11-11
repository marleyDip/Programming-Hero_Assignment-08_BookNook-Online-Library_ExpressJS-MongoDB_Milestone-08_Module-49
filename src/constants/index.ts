import type { Sort } from "mongodb";

export const CATEGORIES = [
  "Fiction",
  "Fantasy",
  "Sci-Fi",
  "History",
  "Self-Help",
  "Classic",
  "Mystery",
  "Science",
  "Kids",
  "Others",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ["New", "Like new", "Good", "Fair"] as const;

export type Condition = (typeof CONDITIONS)[number];

// Only these sort options are accepted from the query string.
export const SORT_OPTIONS: Record<string, Sort> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "title-asc": { title: 1 },
  "title-desc": { title: -1 },
  "author-asc": { author: 1 },
  "author-desc": { author: -1 },
};

export const DEFAULT_SORT = "newest";

export const BORROW_DAYS = 5;
export const DAY_MS = 24 * 60 * 60 * 1000; // 86,400,000 ms in a day

export const LIMITS = {
  title: 200,
  author: 150,
  // image: 5120,
  image: 512,
  description: 500,
  isbn: 20,
  language: 50,
  userName: 100,
  search: 100,
  copiesMin: 1,
  copiesMax: 100,
  yearMin: 1000,
  pageSizeDefault: 10,
  pageSizeMax: 50,
  latestBooks: 8,
} as const;

export const DEFAULT_LANGUAGE = "English";
export const DEFAULT_CONDITION: Condition = "Good";
