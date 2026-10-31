import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";

const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGODB_URI || !DB_NAME) {
  throw new Error("Missing MongoDB environment variables.");
}

// MongoDB Connection
const client = new MongoClient(MONGODB_URI);

let db;
let connectionPromise;

export async function connectToMongoDB() {
  if (db) return db;

  if (!connectionPromise) {
    connectionPromise = client
      .connect()
      .then(() => {
        db = client.db(DB_NAME);
        console.log("Successfully connected to MongoDB!");
        return db;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
}

// Express App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB before handling requests
app.use(async (_req, _res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    next(error);
  }
});

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "BookNook API is running.",
  });
});

// Home Endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Server is running fine!",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

// IMPORTANT: Export Express app for Vercel
// export default app;
