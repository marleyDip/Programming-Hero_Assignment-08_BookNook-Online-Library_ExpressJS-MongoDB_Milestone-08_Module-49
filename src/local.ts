// Local development / traditional hosting entry point.
// On Vercel the app is served through api/index.ts instead.
import app from "./app.js";
import { connectToMongoDB } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await connectToMongoDB();

  app.listen(env.PORT, () => {
    console.log(`BookNook API is running on port ${env.PORT}`);
  });
} catch (error) {
  console.error("Failed to start BookNook API:", error);
  process.exitCode = 1;
}
