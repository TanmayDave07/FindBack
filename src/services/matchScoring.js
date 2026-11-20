export const MATCH_WEIGHTS = {
  category: 30,
  location: 25,
  time: 20,
  color: 10,
  description: 15,
};

export const MIN_MATCH_SCORE = 50;

export function calculateCategoryScore(first, second) {
  return first.categoryId && first.categoryId === second.categoryId
    ? MATCH_WEIGHTS.category : 0;
}

export function calculateLocationScore(first, second, nearbyLocations = []) {
  if (!first.locationId || !second.locationId) return 0;
  if (first.locationId === second.locationId) return MATCH_WEIGHTS.location;

  const nearby = nearbyLocations.some((pair) =>
    (pair.locationId === first.locationId && pair.nearbyLocationId === second.locationId)
    || (pair.locationId === second.locationId && pair.nearbyLocationId === first.locationId)
  );
  return nearby ? MATCH_WEIGHTS.location * 0.6 : 0;
}

export function calculateTimeScore(first, second) {
  const firstTime = new Date(first.eventDate).getTime();
  const secondTime = new Date(second.eventDate).getTime();
  if (!first.eventDate || !second.eventDate || Number.isNaN(firstTime) || Number.isNaN(secondTime)) return 0;

  const hoursApart = Math.abs(firstTime - secondTime) / (60 * 60 * 1000);
  if (hoursApart <= 1) return MATCH_WEIGHTS.time;
  if (hoursApart <= 24) return MATCH_WEIGHTS.time * 0.75;
  if (hoursApart <= 72) return MATCH_WEIGHTS.time * 0.5;
  if (hoursApart <= 168) return MATCH_WEIGHTS.time * 0.25;
  return 0;
}

export function calculateColorScore(first, second) {
  const firstColor = typeof first.color === "string" ? first.color.trim().toLowerCase() : "";
  const secondColor = typeof second.color === "string" ? second.color.trim().toLowerCase() : "";
  return firstColor && firstColor === secondColor ? MATCH_WEIGHTS.color : 0;
}

function getKeywords(description) {
  const text = typeof description === "string" ? description.toLowerCase() : "";
  const words = text.match(/[a-z0-9]+/g) || [];
  const commonWords = ["a", "an", "the", "and", "or", "is", "it", "of", "in", "on", "at", "near", "with", "to", "for"];
  return new Set(words.filter((word) => !commonWords.includes(word)));
}

export function calculateDescriptionScore(first, second) {
  const firstWords = getKeywords(first.description);
  const secondWords = getKeywords(second.description);
  if (!firstWords.size || !secondWords.size) return 0;

  let sharedWords = 0;
  for (const word of firstWords) {
    if (secondWords.has(word)) sharedWords++;
  }
  const totalWords = new Set([...firstWords, ...secondWords]).size;
  const score = (sharedWords / totalWords) * MATCH_WEIGHTS.description;
  return Math.round(score * 100) / 100;
}

export function calculateFinalMatchScore(first, second, nearbyLocations = []) {
  const score = calculateCategoryScore(first, second)
    + calculateLocationScore(first, second, nearbyLocations)
    + calculateTimeScore(first, second)
    + calculateColorScore(first, second)
    + calculateDescriptionScore(first, second);
  return Math.round(score * 100) / 100;
}
