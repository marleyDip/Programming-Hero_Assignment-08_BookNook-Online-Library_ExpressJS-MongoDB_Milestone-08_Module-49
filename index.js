import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";

// import dotenv from "dotenv";
// dotenv.config();

const PORT = process.env.PORT || 8000;

// Verify environment variables
// console.log("MongoDB URI exists:", !!process.env.MONGODB_URI);
// console.log("Database name:", process.env.MONGODB_URI);

// Its class, create new instance or object
const client = new MongoClient(process.env.MONGODB_URI);

// Database Connection - MongoDB
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

// connectToMongoDB();
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("booknook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrowings");
const subscribersCollection = db.collection("subscribers");

// Indexes: fast "newest first" & no duplicate newsletter emails
// createIndex() - Creates one index. It is deprecated in the current driver typings, but still works. Use createIndexes() instead.
/* try {
  await booksCollection.createIndex({ createdAt: -1 });
  await subscribersCollection.createIndex({ email: 1 }, { unique: true });
} catch (err) {
  console.dir(err);
} */

// createIndexes() - Creates multiple indexes in one call.
// Create indexes
try {
  // await booksCollection.createIndexes([
  //   { key: { createdAt: -1 }, name: "createdAt_desc" },
  //   { key: { createdAt: 1 }, name: "createdAt_asc" },
  //   { key: { title: 1 }, name: "title_asc" },
  //   { key: { title: -1 }, name: "title_desc" },
  //   { key: { author: 1 }, name: "author_asc" },
  //   { key: { author: -1 }, name: "author_desc" },
  //   { key: { category: 1 }, name: "category_asc" },
  //   { key: { category: -1 }, name: "category_desc" },
  // ]);

  await booksCollection.createIndexes([
    { key: { createdAt: -1 }, name: "createdAt_desc" },
    // { key: { createdAt: -1 } },
  ]);

  await subscribersCollection.createIndexes([
    {
      key: { email: 1 },
      name: "email_asc",
      unique: true,
    },

    // {
    //   key: { email: 1 },
    //   unique: true,
    // },
  ]);

  console.log("MongoDB indexes created successfully!");
} catch (err) {
  console.error("Failed to create MongoDB indexes:", err);
}

/* Why use createIndexes()?
    - Supports creating multiple indexes together.
    - Allows index options such as unique.
    - Avoids the deprecated method warning in your current driver typings.
*/

// Express App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Helpers
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "title-asc": { title: 1 },
  "title-desc": { title: -1 },
  "author-asc": { author: 1 },
};

// ==== Books =====
/* app.get("/api/books", async (req, res) => {
  const book = await booksCollection.find().toArray();
  res.send(book);
}); */

// ALL BOOKS (filter, search, sort & pagination)
// GET /api/books?category=Fiction&search=dune&sort=title-asc&page=2&limit=10
app.get("/api/books", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const { category, search, sort } = req.query;

    const query = {};

    if (category) {
      query.category = {
        $regex: `^${escapeRegex(String(category))}$`,
        $options: "i",
      };
    }

    if (search) {
      const rx = { $regex: escapeRegex(String(search)), $options: "i" };
      query.$or = [{ title: rx }, { author: rx }];
    }

    const sortBy = SORTS[sort] || SORTS.newest;

    const [books, total] = await Promise.all([
      booksCollection
        .find(query)
        .collation({ locale: "en" }) // proper A-Z ordering, ignores case
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      booksCollection.countDocuments(query),
    ]);

    res.send({
      books,
      total,
      page,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// LATEST 8 BOOKS (newest first)
// IMPORTANT: keep this above "/api/books/:id"
app.get("/api/books/latest", async (_req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 }) // newest first
      .limit(8)
      .toArray();

    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch latest books" });
  }
});

// SINGLE BOOK (View Details page)
app.get("/api/books/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send(book);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch book" });
  }
});

// ADD BOOK (createdAt is what makes "newest" work)
app.post("/api/books", async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      ownerName,
      ownerEmail,
    } = req.body;

    if (!title || !author || !category) {
      return res
        .status(400)
        .send({ message: "title, author and category are required" });
    }

    const book = {
      title: String(title).trim(),
      author: String(author).trim(),
      category: String(category).trim(),
      image: image ? String(image).trim() : "",
      description: description ? String(description).trim() : "",
      ownerName: ownerName || "",
      ownerEmail: ownerEmail ? String(ownerEmail).toLowerCase() : "",
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(book);
    res.status(201).send({ ...book, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Failed to add book" });
  }
});

// ===== Newsletter =====
// POST /api/newsletter   { "email": "a@b.com" }
app.post("/api/newsletter", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .send({ message: "Please enter a valid email address." });
    }

    await subscribersCollection.insertOne({ email, createdAt: new Date() });
    res.status(201).send({ message: "Subscribed" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({ message: "You're already subscribed." });
    }

    res.status(500).send({ message: "Failed to subscribe" });
  }
});

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "BookNook API is running." });
});

// Home Endpoints
app.get("/", (_req, res) => {
  res.send({ message: "Server is running fine!" });
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

// IMPORTANT: Export Express app for Vercel
export default app;
