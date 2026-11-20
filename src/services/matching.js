import { findPotentialMatches } from "./matchFinder.js";

export const MATCHING_FIELDS = [
  "type", "categoryId", "locationId", "eventDate", "color", "description", "status",
];

export async function lockMatching(db) {
  // Finish one report change at a time so simultaneous submissions see each other.
  await db.$executeRaw`LOCK TABLE "Match" IN EXCLUSIVE MODE`;
}

export async function refreshMatches(db, report) {
  const reportPairs = { OR: [{ lostReportId: report.id }, { foundReportId: report.id }] };
  const previousMatches = await db.match.findMany({ where: reportPairs });
  // Keep old rows and IDs for history, but remove stale suggestions from the list.
  await db.match.updateMany({
    where: { ...reportPairs, status: { not: "DISMISSED" } },
    data: { status: "INVALIDATED" },
  });
  const matches = await findPotentialMatches(db, report);
  for (const { lostReportId, foundReportId, score } of matches) {
    const previous = previousMatches.find((match) =>
      match.lostReportId === lostReportId && match.foundReportId === foundReportId
    );
    // Rejected suggestions stay rejected; a valid confirmed pair stays confirmed.
    if (previous && previous.status === "DISMISSED") continue;
    const status = previous && previous.status === "CONFIRMED" ? "CONFIRMED" : "PENDING";
    await db.match.upsert({
      where: { lostReportId_foundReportId: { lostReportId, foundReportId } },
      create: { lostReportId, foundReportId, score },
      update: { score, status },
    });
  }
}
