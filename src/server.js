import app from "./app.js";
import prisma from "./config/db.js";
import env from "./config/env.js";

async function startServer() {
  // Start accepting requests only after the database is connected.
  await prisma.$connect();
  const server = app.listen(env.port, () => {
    console.log(`FindBack API is running on http://localhost:${env.port}`);
  });

  server.on("error", async (error) => {
    console.error("Server failed to start:", error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  function shutdown() {
    server.close(async () => {
      await prisma.$disconnect();
      process.exitCode = 0;
    });
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch(async (error) => {
  console.error("Could not connect to the database:", error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
