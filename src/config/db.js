import { PrismaClient } from "@prisma/client";
import "./env.js";

const prisma = new PrismaClient();

export default prisma;
