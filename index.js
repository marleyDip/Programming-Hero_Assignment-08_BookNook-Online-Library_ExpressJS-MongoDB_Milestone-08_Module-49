import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";

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

// Makes "newest first" fast
// await booksCollection.createIndex({ createdAt: -1 });
// await subscribersCollection.createIndex({ email: 1 }, { unique: true 

// Express App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Books
app.get("/api/books", async (req, res) => {
  const book = await booksCollection.find().toArray();
  res.send(book);
});

app.get("/api/books/latest", async (req, res) => {
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

 // NEWSLETTER SUBSCRIBE  ->  POST /api/newsletter   { "email": "a@b.com" }
  app.post("/api/newsletter", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
	  
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send({ message: "Please enter a valid email address." });
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
