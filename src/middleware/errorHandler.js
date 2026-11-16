import { Prisma } from "@prisma/client";

export default function errorHandler(error, req, res, next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  // Routes set statusCode on ordinary JavaScript errors for expected failures.
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A record with these details already exists." });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Record not found." });
    }
    if (error.code === "P2003") {
      return res.status(409).json({ error: "This record is linked to other records." });
    }
  }

  // Keep database details and stack traces out of API responses.
  console.error("Request failed:", error);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}
