import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Check your .env file.");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters.");
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a number between 1 and 65535.");
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";
if (!/^[1-9]\d*[smhd]$/.test(jwtExpiresIn)) {
  throw new Error("JWT_EXPIRES_IN must look like 30m, 12h, or 1d.");
}

// A separate direct URL is optional when the database does not use a pooler.
process.env.DIRECT_URL ||= process.env.DATABASE_URL;

export default {
  port,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
