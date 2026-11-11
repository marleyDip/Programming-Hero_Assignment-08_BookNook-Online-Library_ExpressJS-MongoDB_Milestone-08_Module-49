import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export const env = {
  PORT: Number(process.env.PORT) || 8000,
  MONGODB_URI: required("MONGODB_URI"),
  DB_NAME: process.env.DB_NAME || "booknook",
  // Better Auth lives on the client app: it serves the JWKS and issues the JWTs.
  CLIENT_URL: required("CLIENT_URL"),
  DASHBOARD_URL: process.env.DASHBOARD_URL || undefined,
  IS_VERCEL: Boolean(process.env.VERCEL),
} as const;
