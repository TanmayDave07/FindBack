import { calculateFinalMatchScore, MIN_MATCH_SCORE } from "./matchScoring.js";

export async function findPotentialMatches(db, report) {
  if (report.status !== "ACTIVE") return [];

  const oppositeType = report.type === "LOST" ? "FOUND" : "LOST";
  const candidates = await db.$queryRaw`
    SELECT "id", "type", "categoryId", "locationId", "eventDate", "color", "description"
    FROM "ItemReport"
    WHERE "type" = ${oppositeType}::"ItemType"
      AND "status" = 'ACTIVE'
      AND "categoryId" = ${report.categoryId}
  `;
  const nearbyLocations = await db.$queryRaw`
    SELECT "locationId", "nearbyLocationId" FROM "NearbyLocation"
    WHERE "locationId" = ${report.locationId} OR "nearbyLocationId" = ${report.locationId}
  `;

  const matches = [];
  for (const candidate of candidates) {
    const score = calculateFinalMatchScore(report, candidate, nearbyLocations);
    if (score < MIN_MATCH_SCORE) continue;
    matches.push({
      lostReportId: report.type === "LOST" ? report.id : candidate.id,
      foundReportId: report.type === "FOUND" ? report.id : candidate.id,
      score,
    });
  }
  return matches;
}
