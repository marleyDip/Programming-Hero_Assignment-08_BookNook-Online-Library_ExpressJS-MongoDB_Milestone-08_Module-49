import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Better Auth publishes its public keys here.
const JWKS = createRemoteJWKSet(new URL(`${env.CLIENT_URL}/api/auth/jwks`));

/**
 * Verifies the Bearer JWT issued by Better Auth and attaches the identity
 * to `req.user` for later handlers.
 */
export const verifyApi = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "Unauthorized!");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new AppError(401, "Token is required!");
  }

  let payload;

  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: env.CLIENT_URL,
      audience: env.CLIENT_URL,
    }));
  } catch (error) {
    console.error(
      "JWT verification failed:",
      error instanceof Error ? error.message : error,
    );

    throw new AppError(401, "Unauthorized: Invalid or expired token.");
  }

  if (typeof payload.email !== "string" || !payload.email.trim()) {
    throw new AppError(401, "Token does not contain a valid user identity.");
  }

  req.user = {
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.trim() : "",
    id: payload.sub,
  };

  next();
}, "Authentication failed.");
