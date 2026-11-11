import type { CorsOptions } from "cors";
import { AppError } from "../utils/AppError.js";
import { env } from "./env.js";

const allowedOrigins = [
  env.CLIENT_URL,
  env.DASHBOARD_URL,
  "http://localhost:3000",
  "https://sofian-booknook-online-library.vercel.app",
].filter((origin): origin is string => Boolean(origin));

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and tools without an Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, "Origin not allowed by CORS."));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],

  allowedHeaders: ["Content-Type", "Authorization"],
};
