import prisma from "../config/db.js";
import { userFields } from "./authController.js";

export async function getUsers(req, res) {
  const users = await prisma.user.findMany({
    select: userFields,
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
}
