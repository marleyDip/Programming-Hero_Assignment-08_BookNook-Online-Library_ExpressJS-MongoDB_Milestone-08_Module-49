import cors from "cors";
import "dotenv/config";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
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

  await subscribersCollection.createIndex(
    { email: 1 },
    {
      unique: true,
      name: "unique_subscriber_email",
    },
  );
} catch (err) {
  console.dir(err);
} */

// createIndexes() - Creates multiple indexes in one call.
// Create indexes
/* try {
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

  // await booksCollection.createIndexes([
  //   { key: { createdAt: -1 }, name: "createdAt_desc" },
  //   // { key: { createdAt: -1 } },
  // ]);

  console.log("MongoDB indexes created successfully!");
} catch (err) {
  console.error("Failed to create MongoDB indexes:", err);
} */

/* Why use createIndexes()?
    - Supports creating multiple indexes together.
    - Allows index options such as unique.
    - Avoids the deprecated method warning in your current driver typings.
*/

// MongoDB indexes for performance

try {
  // 1. Create books indexes
  await booksCollection.createIndexes([
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
  ]);

  await booksCollection.createIndexes([
    {
      key: { ownerEmail: 1, createdAt: -1, _id: -1 },
      name: "books_owner_createdAt",
    },
  ]);

  await borrowsCollection.createIndex(
    { bookId: 1, status: 1 },
    { name: "borrowings_bookId_status" },
  );

  await borrowsCollection.createIndex(
    {
      bookId: 1,
      userEmail: 1,
    },
    {
      name: "unique_active_borrowing",
      unique: true,
      partialFilterExpression: {
        status: "borrowed",
      },
    },
  );

  await borrowsCollection.createIndex(
    {
      bookId: 1,
      status: 1,
    },
    {
      name: "borrowings_bookId_status",
    },
  );

  await borrowsCollection.createIndex(
    {
      userEmail: 1,
      borrowDate: -1,
      _id: -1,
    },
    {
      name: "borrowings_user_borrowDate",
    },
  );

  // 2. Find duplicate subscriber emails
  const duplicates = await subscribersCollection
    .aggregate([
      {
        $sort: {
          createdAt: 1,
          _id: 1,
        },
      },
      {
        $group: {
          _id: "$email",
          ids: { $push: "$_id" },
        },
      },
      {
        $project: {
          duplicateIds: {
            $slice: ["$ids", 1, { $size: "$ids" }],
          },
        },
      },
    ])
    .toArray();

  // Extract duplicate ObjectIds
  const idsToDelete = duplicates.flatMap((item) => item.duplicateIds);

  // Delete duplicate subscribers
  if (idsToDelete.length > 0) {
    const result = await subscribersCollection.deleteMany({
      _id: { $in: idsToDelete },
    });

    console.log("Deleted duplicate subscribers:", result.deletedCount);
  } else {
    console.log("No duplicate subscribers found.");
  }

  // 4. Create unique email index
  await subscribersCollection.createIndexes([
    {
      key: { email: 1 },
      name: "email_asc",
      unique: true,
    },
  ]);

  console.log("MongoDB indexes created successfully!");
} catch (error) {
  console.error("Failed to create MongoDB indexes:", error);
}

/* const booksIndexes = await booksCollection.indexes();
const subscriberIndexes = await subscribersCollection.indexes();

console.log("Books indexes:", booksIndexes);
console.log("Subscriber indexes:", subscriberIndexes);

console.table(
  booksIndexes.map(({ name, key, unique }) => ({
    name,
    key: JSON.stringify(key),
    unique: unique || false,
  })),
); */

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
  "author-desc": { author: -1 },
};

const CATEGORIES = [
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
];
const CONDITIONS = ["New", "Like new", "Good", "Fair"];
const BORROW_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000; // milliseconds in a standard 24-hour day (86,400,000 milliseconds) - Hour, Minute, Second

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/* const verifyApi = (req, res, next) => {
  const authHeaders = req.headers.authorization;
  // console.log(authHeaders);

  // if (authHeaders !== "user logged in") {
  //   return res.status(401).send({ msg: "Unauthorized!" });
  // }
  // console.log("I am Middleware");

  if (!authHeaders) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  //const token = authHeaders.split(" ");
  //console.log(token);

  const token = authHeaders.split(" ")[1];
  // console.log(token);

  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks"),
  );

  // const { payload } = await jwtVerify(token, JWKS);
  // console.log(payload);
  // next();

  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(500).send({ msg: "Server Error!" });
  }
}; */

/**
 *
 * Verify with JWKS (JSON WEB KEY SET)
 * "jose" package
 *
 * http://localhost:3000/api/auth/jwks
 *
 */

// Better Auth JWKS
const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", process.env.BETTER_AUTH_URL),

  // new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`),
);

// JWT Verification Middleware
const verifyApi = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized!",
    });
  }

  // const token = authHeaders.split(" ")[1];
  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token is required!",
    });
  }

  try {
    // verifies the JWT and extracts its payload.
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);

    // makes the verified identity available to subsequent handlers.
    req.user = payload;

    // passes control to the next middleware or route handler.
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token.",
    });
  }
};

// Write/private routes are called by the Next.js server only (Server Actions),
// which sends this shared secret. Set INTERNAL_API_KEY in both .env files.
// Old Method - Now used betterAuth. No need to manual protection.
/* const requireApiKey = (req, res, next) => {
  const key = process.env.INTERNAL_API_KEY;
  if (!key || req.get("x-api-key") !== key) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  next();
}; */

// ==== Books =====
/* app.get("/api/books", async (req, res) => {
  const book = await booksCollection.find().toArray();
  res.send(book);
}); */

// ALL BOOKS (filter, search, sort & pagination)
// GET /api/books?category=Fiction&search=dune&sort=title-asc&page=2&limit=10
app.get("/api/books", async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 50);

    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

    // Validate search input
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query is too long.",
      });
    }

    // Build MongoDB filter
    const filter = {};

    if (category) {
      filter.category = {
        $regex: `^${escapeRegex(category)}$`,
        $options: "i",
      };
    }

    if (search) {
      const regex = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      filter.$or = [{ title: regex }, { author: regex }];
    }

    // Allow only predefined sorting options
    const sortBy = SORTS[sort] || SORTS.newest;

    const skip = (page - 1) * limit;

    // Fetch books and total count concurrently
    // Fetch books and total count concurrently
    const [books, total] = await Promise.all([
      booksCollection
        .find(filter)
        .collation({ locale: "en", strength: 2 })
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .toArray(),

      booksCollection.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully.",
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
  } catch (error) {
    console.error("Get books error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch books.",
    });
  }
});

/* 
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
*/

// LATEST 8 BOOKS (newest first)
// IMPORTANT: keep this above "/api/books/:id"
app.get("/api/books/latest", async (_req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1, _id: -1 }) // newest first
      .limit(8)
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Latest books fetched successfully.",
      data: books,
    });

    // res.send(books);
  } catch (error) {
    console.error("Get latest books error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch latest books.",
    });

    // res.status(500).send({ message: "Failed to fetch latest books" });
  }
});

/**
 * SINGLE BOOK (View Details page)
 * GET /api/books/:id
 * Get a single book by MongoDB ObjectId
 * Used by: Book Details page
 * Used Middleware to secure api
 *
 * Request => Middleware (check authenticated or not) => Response, back to client
 *
 * Here, "verifyApi" is Middleware
 *
 */
app.get("/api/books/:id", verifyApi, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    // 2. Fetch book
    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    // 3. Handle book not found
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    // 4. Return successful response
    return res.status(200).json({
      success: true,
      message: "Book fetched successfully.",
      data: book,
    });

    // res.send(book);
  } catch (error) {
    console.error("Get single book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch book.",
    });
  }
});

/* app.get(
  "/api/books/:id",
  (req, res, next) => {
    const authHeaders = req.headers.authorization;
    console.log(authHeaders);

    if (authHeaders !== "user logged in") {
      return res.status(401).send({ msg: "Unauthorized!" });
    }

    console.log("I am Middleware");

    next();
  },

  async (req, res) => {
    // const authHeaders = req.headers.authorization;
    // console.log(authHeaders);

    // if (authHeaders !== "user logged in") {
    //   return res.status(401).send({ msg: "Unauthorized!" });
    // }

    try {
      const { id } = req.params;

      // 1. Validate MongoDB ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid book ID.",
        });
      }

      // 2. Fetch book
      const book = await booksCollection.findOne({
        _id: new ObjectId(id),
      });

      // 3. Handle book not found
      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      // 4. Return successful response
      return res.status(200).json({
        success: true,
        message: "Book fetched successfully.",
        data: book,
      });

      // res.send(book);
    } catch (error) {
      console.error("Get single book error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch book.",
      });
    }
  },
); */

// ADD BOOK (createdAt is what makes "newest" work)
app.post("/api/books", async (req, res) => {
  try {
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
      ownerName,
      ownerEmail,
    } = req.body ?? {};

    // 1. Validate required fields
    const requiredFields = {
      title,
      author,
      category,
      ownerEmail,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => typeof value !== "string" || !value.trim())
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
        errors: missingFields,
      });
    }

    // 2. Normalize input
    const normalizedTitle = title.trim();
    const normalizedAuthor = author.trim();
    const normalizedCategory = category.trim();
    const normalizedEmail = ownerEmail.trim().toLowerCase();

    // 3. Validate category
    if (!CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book category.",
      });
    }

    // 4. Validate total copies
    const copies = Number(totalCopies);

    if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be between 1 and 100.",
      });
    }

    // 5. Validate publication year
    let year = null;

    if (
      publishedYear !== undefined &&
      publishedYear !== null &&
      publishedYear !== ""
    ) {
      year = Number(publishedYear);

      const currentYear = new Date().getFullYear();

      if (!Number.isInteger(year) || year < 1000 || year > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid publication year.",
        });
      }
    }

    // 6. Validate email
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid owner email.",
      });
    }

    // 7. Validate optional string lengths
    const optionalString = (value, maxLength, fallback = "") => {
      if (value === undefined || value === null) return fallback;

      if (typeof value !== "string") return null;

      const normalized = value.trim();

      return normalized.length <= maxLength ? normalized : null;
    };

    const normalizedImage = optionalString(image, 2048);
    const normalizedDescription = optionalString(description, 500);
    const normalizedIsbn = optionalString(isbn, 20);
    const normalizedLanguage = optionalString(language, 50, "English");
    const normalizedOwnerName = optionalString(ownerName, 100);

    if (
      normalizedImage === null ||
      normalizedDescription === null ||
      normalizedIsbn === null ||
      normalizedLanguage === null ||
      normalizedOwnerName === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more optional fields have invalid values or exceed their allowed length.",
      });
    }

    // 8. Validate book condition
    const normalizedCondition = CONDITIONS.includes(condition)
      ? condition
      : "Good";

    // 9. Create book document
    const book = {
      title: normalizedTitle,
      author: normalizedAuthor,
      category: normalizedCategory,
      image: normalizedImage,
      description: normalizedDescription,
      totalCopies: copies,
      availableCopies: copies,
      isbn: normalizedIsbn,
      publishedYear: year,
      language: normalizedLanguage,
      condition: normalizedCondition,
      ownerName: normalizedOwnerName,
      ownerEmail: normalizedEmail,
      createdAt: new Date(),
    };

    // 10. Insert into MongoDB
    const result = await booksCollection.insertOne(book);

    return res.status(201).json({
      success: true,
      message: "Book added successfully.",
      data: {
        ...book,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Add book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add book.",
    });
  }
});

// MY BOOKS  ->  GET /api/my-books?email=a@b.com
app.get("/api/my-books", async (req, res) => {
  try {
    // 1. Validate and normalize email
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Owner email is required.",
      });
    }

    // 2. Validate email format
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // 3. Fetch owner's books
    const books = await booksCollection
      .find({ ownerEmail: email })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    // 4. Return response
    return res.status(200).json({
      success: true,
      message: books.length
        ? "Your books fetched successfully."
        : "No books found.",
      data: books,
      total: books.length,
    });
  } catch (error) {
    console.error("Get my books error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your books.",
    });
  }
});

// UPDATE BOOK (owner only)  ->  PUT /api/books/:id?email=a@b.com
app.put("/api/books/:id", async (req, res) => {
  try {
    // 1. Validate book ID
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    // 2. Validate owner email
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid owner email is required.",
      });
    }

    // 3. Extract request body
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
    } = req.body ?? {};

    // 4. Validate required fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      typeof category !== "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, author and category are required.",
      });
    }

    // 5. Normalize input
    const normalizedTitle = title.trim();
    const normalizedAuthor = author.trim();
    const normalizedCategory = category.trim();

    // 6. Validate category
    if (!CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book category.",
      });
    }

    // 7. Validate total copies
    const copies = Number(totalCopies);

    if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be between 1 and 100.",
      });
    }

    // 8. Validate optional string fields
    const optionalString = (value, maxLength, fallback = "") => {
      if (value === undefined || value === null) return fallback;
      if (typeof value !== "string") return null;

      const normalized = value.trim();

      return normalized.length <= maxLength ? normalized : null;
    };

    const normalizedImage = optionalString(image, 2048);
    const normalizedDescription = optionalString(description, 500);
    const normalizedIsbn = optionalString(isbn, 20);
    const normalizedLanguage = optionalString(language, 50, "English");

    if (
      normalizedImage === null ||
      normalizedDescription === null ||
      normalizedIsbn === null ||
      normalizedLanguage === null
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more optional fields are invalid or too long.",
      });
    }

    // 9. Validate publication year
    let year = null;

    if (
      publishedYear !== undefined &&
      publishedYear !== null &&
      publishedYear !== ""
    ) {
      year = Number(publishedYear);

      const currentYear = new Date().getFullYear();

      if (!Number.isInteger(year) || year < 1000 || year > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid publication year.",
        });
      }
    }

    // 10. Validate condition
    if (condition !== undefined && !CONDITIONS.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book condition.",
      });
    }

    const normalizedCondition = condition ?? "Good";

    // 11. Find existing book
    const _id = new ObjectId(id);

    const book = await booksCollection.findOne({
      _id,
      ownerEmail: email,
    });

    if (!book) {
      const exists = await booksCollection.findOne(
        { _id },
        { projection: { _id: 1 } },
      );

      return res.status(exists ? 403 : 404).json({
        success: false,
        message: exists
          ? "You can only edit your own books."
          : "Book not found.",
      });
    }

    // 12. Calculate borrowed copies
    const total = book.totalCopies ?? 1;
    const available = book.availableCopies ?? total;
    const borrowedNow = Math.max(0, total - available);

    if (copies < borrowedNow) {
      return res.status(400).json({
        success: false,
        message: `${borrowedNow} copies are borrowed right now, so total copies cannot be less than ${borrowedNow}.`,
      });
    }

    // 13. Prepare update
    const changes = {
      title: normalizedTitle,
      author: normalizedAuthor,
      category: normalizedCategory,
      image: normalizedImage,
      description: normalizedDescription,
      totalCopies: copies,
      availableCopies: copies - borrowedNow,
      isbn: normalizedIsbn,
      publishedYear: year,
      language: normalizedLanguage,
      condition: normalizedCondition,
      updatedAt: new Date(),
    };

    // 14. Atomic ownership and availability check
    const result = await booksCollection.updateOne(
      {
        _id,
        ownerEmail: email,
        totalCopies: total,
        availableCopies: available,
        $expr: {
          $lte: [{ $subtract: ["$totalCopies", "$availableCopies"] }, copies],
        },
      },
      {
        $set: changes,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(409).json({
        success: false,
        message:
          "Book data changed during the update. Please refresh and try again.",
      });
    }

    // 15. Return updated book
    return res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      data: {
        _id,
        ...book,
        ...changes,
      },
    });
  } catch (error) {
    console.error("Update book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update book.",
    });
  }
});

// DELETE BOOK (owner only)  ->  DELETE /api/books/:id?email=a@b.com
app.delete("/api/books/:id", async (req, res) => {
  try {
    // 1. Validate MongoDB ObjectId
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    // 2. Validate owner email
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid owner email is required.",
      });
    }

    const _id = new ObjectId(id);

    // 3. Find the book and verify ownership
    const book = await booksCollection.findOne({
      _id,
      ownerEmail: email,
    });

    if (!book) {
      // Check whether the book exists but belongs to someone else
      const exists = await booksCollection.findOne(
        { _id },
        { projection: { _id: 1 } },
      );

      return res.status(exists ? 403 : 404).json({
        success: false,
        message: exists
          ? "You can only delete your own books."
          : "Book not found.",
      });
    }

    // 4. Check active borrowings
    const activeBorrows = await borrowsCollection.findOne(
      {
        bookId: _id,
        status: "borrowed",
      },
      {
        projection: { _id: 1 },
      },
    );

    if (activeBorrows) {
      return res.status(409).json({
        success: false,
        message:
          "Some copies are currently borrowed. Return them before deleting this book.",
      });
    }

    // 5. Delete the book with ownership protection
    const result = await booksCollection.deleteOne({
      _id,
      ownerEmail: email,
    });

    if (result.deletedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "The book could not be deleted. Please try again.",
      });
    }

    // 6. Success response
    return res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
      data: {
        _id: id,
      },
    });
  } catch (error) {
    console.error("Delete book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete book.",
    });
  }
});

// ===== Borrowing =====
// BORROW A BOOK  ->  POST /api/borrows   { bookId, userEmail, userName }
app.post("/api/borrows", async (req, res) => {
  const session = client.startSession();

  try {
    // 1. Validate request body
    const { bookId, userEmail, userName } = req.body ?? {};

    if (
      typeof bookId !== "string" ||
      !ObjectId.isValid(bookId) ||
      typeof userEmail !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid bookId and userEmail are required.",
      });
    }

    // 2. Normalize and validate email
    const email = userEmail.trim().toLowerCase();
    const name = typeof userName === "string" ? userName.trim() : "";

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "User name must not exceed 100 characters.",
      });
    }

    const _id = new ObjectId(bookId);

    let outcome;

    // 3. Execute borrowing transaction
    await session.withTransaction(async () => {
      // Find book
      const book = await booksCollection.findOne({ _id }, { session });

      if (!book) {
        outcome = {
          status: 404,
          message: "Book not found.",
        };
        return;
      }

      // Prevent borrowing own book
      if (book.ownerEmail === email) {
        outcome = {
          status: 400,
          message: "You can't borrow your own book.",
        };
        return;
      }

      // Check existing active borrowing
      const alreadyBorrowed = await borrowsCollection.findOne(
        {
          bookId: _id,
          userEmail: email,
          status: "borrowed",
        },
        {
          projection: { _id: 1 },
          session,
        },
      );

      if (alreadyBorrowed) {
        outcome = {
          status: 409,
          message: "You have already borrowed this book.",
        };
        return;
      }

      // Atomically decrease available copies
      const updateResult = await booksCollection.updateOne(
        {
          _id,
          availableCopies: { $gt: 0 },
        },
        {
          $inc: { availableCopies: -1 },
        },
        { session },
      );

      if (updateResult.modifiedCount !== 1) {
        outcome = {
          status: 409,
          message: "No copies are available right now.",
        };
        return;
      }

      // Create borrowing record
      const now = new Date();

      const borrowing = {
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

      const result = await borrowsCollection.insertOne(borrowing, { session });

      outcome = {
        status: 201,
        message: `Borrowed successfully! Please return it within ${BORROW_DAYS} days.`,
        data: {
          _id: result.insertedId,
          bookId,
          returnDate: borrowing.returnDate,
          status: borrowing.status,
        },
      };
    });

    // 4. Send response
    return res.status(outcome.status).json({
      success: outcome.status === 201,
      message: outcome.message,
      ...(outcome.data ? { data: outcome.data } : {}),
    });
  } catch (error) {
    console.error("Borrow book error:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to borrow the book.",
    });
  } finally {
    await session.endSession();
  }
});

// MY BORROWS  ->  GET /api/borrows?email=a@b.com
app.get("/api/borrows", async (req, res) => {
  try {
    // 1. Validate email
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    // 2. Fetch user's borrowing records
    const borrows = await borrowsCollection
      .find({ userEmail: email })
      .sort({ borrowDate: -1, _id: -1 })
      .toArray();

    // 3. Send response
    return res.status(200).json({
      success: true,
      message: borrows.length
        ? "Your borrowing records fetched successfully."
        : "No borrowing records found.",
      data: borrows,
      total: borrows.length,
    });
  } catch (error) {
    console.error("Get borrows error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your borrowing records.",
    });
  }
});

// RETURN A BOOK  ->  PATCH /api/borrows/:id/return   { userEmail }
app.patch("/api/borrows/:id/return", async (req, res) => {
  const session = client.startSession();

  try {
    // 1. Validate borrowing ID
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid borrowing ID.",
      });
    }

    // 2. Validate user email
    const email =
      typeof req.body?.userEmail === "string"
        ? req.body.userEmail.trim().toLowerCase()
        : "";

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid user email is required.",
      });
    }

    const _id = new ObjectId(id);

    let outcome;

    // 3. Execute return transaction
    await session.withTransaction(async () => {
      outcome = undefined;

      // Find active borrowing belonging to this user
      const borrow = await borrowsCollection.findOne(
        {
          _id,
          userEmail: email,
          status: "borrowed",
        },
        { session },
      );

      if (!borrow) {
        outcome = {
          status: 404,
          message: "Active borrowing not found.",
        };
        return;
      }

      // Increment available copies safely
      const bookResult = await booksCollection.updateOne(
        {
          _id: borrow.bookId,
          $expr: {
            $lt: ["$availableCopies", "$totalCopies"],
          },
        },
        {
          $inc: { availableCopies: 1 },
        },
        { session },
      );

      // Abort transaction if book is missing or stock is inconsistent
      if (bookResult.modifiedCount !== 1) {
        throw new Error(
          "Book not found or available copies are already at maximum.",
        );
      }

      // Mark borrowing as returned
      const now = new Date();

      const borrowResult = await borrowsCollection.updateOne(
        {
          _id,
          userEmail: email,
          status: "borrowed",
        },
        {
          $set: {
            status: "returned",
            returnedAt: now,
          },
        },
        { session },
      );

      // Abort if borrowing status changed unexpectedly
      if (borrowResult.modifiedCount !== 1) {
        throw new Error("Borrowing status changed unexpectedly.");
      }

      outcome = {
        status: 200,
        message: "Book returned successfully. Thank you!",
        data: {
          _id: id,
          bookId: borrow.bookId,
          status: "returned",
          returnedAt: now,
        },
      };
    });

    // 4. Send response
    return res.status(outcome.status).json({
      success: outcome.status === 200,
      message: outcome.message,
      ...(outcome.data ? { data: outcome.data } : {}),
    });
  } catch (error) {
    console.error("Return book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to return the book.",
    });
  } finally {
    await session.endSession();
  }
});

// ===== Newsletter =====
// POST /api/newsletter   { "email": "a@b.com" }
app.post("/api/newsletter", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).send({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingSubscriber = await subscribersCollection.findOne({
      email,
    });

    if (existingSubscriber) {
      return res.status(409).send({
        success: false,
        message: "You're already subscribed.",
      });
    }

    await subscribersCollection.insertOne({
      email,
      createdAt: new Date(),
    });

    return res.status(201).send({
      success: true,
      message: "Subscribed successfully!",
    });
  } catch (error) {
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).send({
        success: false,
        message: "You're already subscribed.",
      });
    }

    console.error("Newsletter subscription error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to subscribe.",
    });
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

/* Find duplicate emails
Run this aggregation in MongoDB Atlas → booknook → subscribers → Aggregations:

[
  {
    $group: {
      _id: "$email",
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]

Stage 1 — $group
Select $group and paste:
{
  "_id": "$email",
  "count": { "$sum": 1 },
  "ids": { "$push": "$_id" }
}

Stage 2 — $match
Click Add Stage, select $match, and paste:
{
  "count": { "$gt": 1 }
}


Remove duplicate documents
If you want to keep the oldest subscription and delete the extra documents, you can run:

db.subscribers.aggregate([
  {
    $sort: { createdAt: 1 }
  },
  {
    $group: {
      _id: "$email",
      ids: { $push: "$_id" }
    }
  },
  {
    $project: {
      duplicateIds: {
        $slice: ["$ids", 1, { $size: "$ids" }]
      }
    }
  },
  {
    $unwind: "$duplicateIds"
  },
  {
    $group: {
      _id: null,
      idsToDelete: { $push: "$duplicateIds" }
    }
  }
]).forEach((doc) => {
  db.subscribers.deleteMany({
    _id: { $in: doc.idsToDelete }
  });
});

*/
