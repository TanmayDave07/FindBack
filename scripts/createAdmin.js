import bcrypt from "bcrypt";
import prisma from "../src/config/db.js";
import { readAuthInput } from "../src/middleware/validation.js";

async function createAdmin() {
  const { name, email, password } = readAuthInput({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }, true);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("This email already exists. Use a new email for the admin account.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, role: "ADMIN" } });
  console.log("Admin account created. You can now log in through /api/auth/login.");
}

createAdmin()
  .catch((error) => {
    console.error("Could not create admin:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
