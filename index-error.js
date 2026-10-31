import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";

import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("./.env", import.meta.url)),
});

const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

console.log("MongoDB URI exists:", !!process.env.MONGODB_URI);
console.log("Database name:", process.env.DB_NAME);

// Validate environment variables
if (!MONGODB_URI || !DB_NAME) {
  throw new Error("Missing MONGODB_URI or DB_NAME in .env file");
}

// Database Connection
const client = new MongoClient(MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();

    const db = client.db(DB_NAME);

    console.log("Successfully connected to MongoDB!");

    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Start Server
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`Server is running at ${PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

startServer();
