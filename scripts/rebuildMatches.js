import prisma from "../src/config/db.js";
import { lockMatching, refreshMatches } from "../src/services/matching.js";

try {
  const total = await prisma.$transaction(async (db) => {
    await lockMatching(db);
    const reports = await db.itemReport.findMany();
    for (const report of reports) {
      await refreshMatches(db, report);
    }
    return db.match.count({ where: { status: "PENDING" } });
  }, { timeout: 30000 });
  console.log(`Matching complete: ${total} potential matches stored.`);
} catch (error) {
  console.error("Could not rebuild matches:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
