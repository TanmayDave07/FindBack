import prisma from "../config/db.js";

export async function getCategories(req, res) {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
}

export async function getLocations(req, res) {
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  res.json({ locations });
}
