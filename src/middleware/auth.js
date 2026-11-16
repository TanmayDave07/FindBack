import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import env from "../config/env.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !/^Bearer \S+$/i.test(header)) {
    const error = new Error("Please provide a Bearer token.");
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(header.split(" ")[1], env.jwtSecret, {
      algorithms: ["HS256"],
    });
  } catch {
    const error = new Error("Invalid or expired token. Please log in again.");
    error.statusCode = 401;
    throw error;
  }

  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    const error = new Error("Invalid token. Please log in again.");
    error.statusCode = 401;
    throw error;
  }

  // Read the current role from the database so role changes apply immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    const error = new Error("This account no longer exists.");
    error.statusCode = 401;
    throw error;
  }

  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    const error = new Error("Admin access is required.");
    error.statusCode = 403;
    throw error;
  }
  next();
}
