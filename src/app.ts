import cors from "cors";
import express from "express";

import { corsOptions } from "./config/cors.js";
import { ensureDbConnection } from "./middlewares/db.middleware.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(cors(corsOptions));

// Rejecting bodies over 1 MB protects the server from oversized-payload (DoS) attacks.
app.use(express.json({ limit: "1mb" }));

app.use(ensureDbConnection);

app.get("/", (_req, res) => {
  res.json({ message: "Server is running fine!" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
