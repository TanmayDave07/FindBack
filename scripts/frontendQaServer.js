// Local test server only. It uses a separate database and never changes .env.
import express from "express";
import fs from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to an isolated test database.");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = randomBytes(32).toString("hex");
const prisma = (await import("../src/config/db.js")).default;
const app = (await import("../src/app.js")).default;
if (await prisma.itemReport.count()) throw new Error("The test database already contains reports. Use an empty test database.");

const passwordHash = await bcrypt.hash("FrontendTest123!",12);
const users = {};
for (const [role,name] of [["student","Yash Raj"],["admin","Tanmay Dave"]]) {
  users[role] = await prisma.user.create({data:{name,email:`${role}-${randomUUID()}@example.com`,passwordHash,role:role === "admin" ? "ADMIN" : "STUDENT"}});
}
const categories = {};
for (const name of ["Wallet","Phone","Keys","Bags","Other"]) categories[name] = await prisma.category.create({data:{name}});
const locations = {};
for (const name of ["Library","A Block","R1","Main Ground"]) locations[name] = await prisma.location.create({data:{name}});
for (const [title,type,category,location,color,description] of [
  ["Black wallet","FOUND","Wallet","Library","Black","Black leather wallet"],
  ["Leather wallet","FOUND","Wallet","Library","Black","Black wallet"],
  ["Brown leather wallet","FOUND","Wallet","Library","Brown","Black leather wallet"],
  ["Blue water bottle","LOST","Other","R1","Blue","Blue water bottle"],
  ["Campus keys","FOUND","Keys","A Block","Silver","Three silver keys on a small keyring"],
  ["Navy backpack","LOST","Bags","Main Ground","Navy","Navy backpack with two front pockets"],
]) await prisma.itemReport.create({data:{title,type,categoryId:categories[category].id,locationId:locations[location].id,color,description,userId:users.student.id,eventDate:new Date("2026-11-10T08:55:00Z"),privateDetails:"Private QA identifying detail"}});

const server = express();
server.use(express.json());
server.get("/",async (req,res,next) => {
  const account = req.query.account === "harsh" ? await prisma.user.findUnique({where:{email:"frontend-harsh@example.com"}}) : users[req.query.account];
  if (!account && req.query.flow !== "student" && req.query.flow !== "admin") return next();
  let head = "";
  if (account) {
    const user = {id:account.id,name:account.name,email:account.email,role:account.role};
    const token = jwt.sign({},process.env.JWT_SECRET,{subject:user.id,expiresIn:"1h",algorithm:"HS256"});
    head += `<script>sessionStorage.setItem('findback-session', ${JSON.stringify(JSON.stringify({user,token}))})</script>`;
  }
  if (req.query.flow) head += '<script type="module" src="/qa-flow.js"></script>';
  res.type("html").send(fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8").replace("<head>",`<head>${head}`));
});
server.get("/qa-flow.js",(req,res) => res.sendFile(fileURLToPath(new URL("../tests/frontend-browser-flow.js",import.meta.url))));
server.post("/qa-results",(req,res) => {
  fs.mkdirSync(".taste-skill",{recursive:true});
  const kind = ["admin","student","mobile"].includes(req.body.kind) ? req.body.kind : "student";
  fs.writeFileSync(`.taste-skill/frontend-${kind}-results.json`,JSON.stringify(req.body,null,2));
  res.json({saved:true});
});
server.use(app);
const listener = server.listen(3188,"127.0.0.1",()=>console.log("Frontend QA server ready at http://127.0.0.1:3188"));
process.once("SIGTERM",() => listener.close(async()=>{await prisma.$disconnect();process.exitCode=0;}));
process.once("SIGINT",() => listener.close(async()=>{await prisma.$disconnect();process.exitCode=0;}));
