import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import env from "../config/env.js";

export const userFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

function createToken(user) {
  return jwt.sign({}, env.jwtSecret, {
    subject: user.id,
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
  });
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "STUDENT" },
    select: userFields,
  });
  res.status(201).json({ user, token: createToken(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Incorrect email or password.");
    error.statusCode = 401;
    throw error;
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    token: createToken(user),
  });
}

export function getMe(req, res) {
  res.json({ user: req.user });
}
