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

connectToMongoDB();

// Express App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
