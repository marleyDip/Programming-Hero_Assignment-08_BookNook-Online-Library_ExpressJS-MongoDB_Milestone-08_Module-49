import "dotenv/config";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "booknook";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not configured.");
}

const client = new MongoClient(MONGODB_URI);

async function createIndexes(): Promise<void> {
  try {
    await client.connect();

    console.log("Connected to MongoDB successfully.");

    const db = client.db(DB_NAME);

    // Books
    await db.collection("books").createIndexes([
      {
        key: { createdAt: -1 },
        name: "books_createdAt_desc",
      },
      {
        key: { category: 1, createdAt: -1 },
        name: "books_category_createdAt",
      },
      {
        key: { title: 1 },
        name: "books_title_asc",
        collation: { locale: "en", strength: 2 },
      },
      {
        key: { author: 1 },
        name: "books_author_asc",
        collation: { locale: "en", strength: 2 },
      },
      {
        key: { ownerEmail: 1, createdAt: -1, _id: -1 },
        name: "books_owner_createdAt",
      },
    ]);

    console.log("Books indexes created.");

    // Borrowings
    await db.collection("borrowings").createIndexes([
      {
        key: { bookId: 1, status: 1 },
        name: "borrowings_bookId_status",
      },
      {
        // A user can have only one active borrowing per book.
        key: { bookId: 1, userEmail: 1 },
        name: "unique_active_borrowing",
        unique: true,
        partialFilterExpression: { status: "borrowed" },
      },
      {
        key: { userEmail: 1, borrowDate: -1, _id: -1 },
        name: "borrowings_user_borrowDate",
      },
    ]);

    console.log("Borrowings indexes created.");

    // Subscribers
    await db.collection("subscribers").createIndexes([
      {
        key: { email: 1 },
        name: "email_asc",
        unique: true,
      },
    ]);

    console.log("Subscriber indexes created.");
    console.log("All MongoDB indexes are ready!");
  } catch (error) {
    console.error("MongoDB index setup failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

await createIndexes();
