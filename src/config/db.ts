import { MongoClient, type Db } from "mongodb";
import type {
  BookDocument,
  BorrowingDocument,
  SubscriberDocument,
} from "../types/index.js";
import { env } from "./env.js";

// Reuse one MongoClient per serverless runtime.
export const client = new MongoClient(env.MONGODB_URI, {
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000,
  waitQueueTimeoutMS: 10000,
});

export const db = client.db(env.DB_NAME);

export const collections = {
  books: db.collection<BookDocument>("books"),
  borrowings: db.collection<BorrowingDocument>("borrowings"),
  subscribers: db.collection<SubscriberDocument>("subscribers"),
} as const;

let connectionPromise: Promise<MongoClient> | null = null;

export function connectToMongoDB(): Promise<Db> {
  if (!connectionPromise) {
    connectionPromise = client.connect().catch((error: unknown) => {
      connectionPromise = null;

      console.error("MongoDB connection failed:", error);
      throw error;
    });
  }

  return connectionPromise.then(() => db);
}
