import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MATCH_WEIGHTS, calculateCategoryScore, calculateLocationScore,
  calculateTimeScore, calculateColorScore, calculateDescriptionScore,
  calculateFinalMatchScore,
} from "../src/services/matchScoring.js";

const lost = {
  categoryId: "wallet", locationId: "library", color: "Black",
  eventDate: "2026-11-10T14:00:00Z", description: "Black leather wallet",
};
const found = { ...lost, eventDate: "2026-11-10T14:30:00Z" };

describe("Matching scores", () => {
  it("uses the requested weights totalling 100", () => {
    assert.deepEqual(MATCH_WEIGHTS, { category: 30, location: 25, time: 20, color: 10, description: 15 });
    assert.equal(Object.values(MATCH_WEIGHTS).reduce((total, weight) => total + weight, 0), 100);
  });

  it("awards category points only for the same known category", () => {
    assert.equal(calculateCategoryScore(lost, found), 30);
    assert.equal(calculateCategoryScore(lost, { ...found, categoryId: "phone" }), 0);
    assert.equal(calculateCategoryScore({}, {}), 0);
  });

  it("scores exact locations and manually defined neighbours in either direction", () => {
    const nearby = [{ locationId: "library", nearbyLocationId: "main-ground" }];
    const atGround = { ...found, locationId: "main-ground" };
    assert.equal(calculateLocationScore(lost, found), 25);
    assert.equal(calculateLocationScore(lost, atGround, nearby), 15);
    assert.equal(calculateLocationScore(atGround, lost, nearby), 15);
    assert.equal(calculateLocationScore(lost, atGround), 0);
    assert.equal(calculateLocationScore({}, {}), 0);
  });

  it("decreases time points at the documented hour and day boundaries", () => {
    for (const [hours, expected] of [[0, 20], [1, 20], [1.01, 15], [24, 15], [24.01, 10], [72, 10], [72.01, 5], [168, 5], [168.01, 0]]) {
      const other = { ...found, eventDate: new Date(new Date(lost.eventDate).getTime() + hours * 3600000) };
      assert.equal(calculateTimeScore(lost, other), expected, `${hours} hours`);
      assert.equal(calculateTimeScore(other, lost), expected, `${hours} hours reversed`);
    }
    assert.equal(calculateTimeScore(lost, { eventDate: "invalid" }), 0);
    assert.equal(calculateTimeScore({}, {}), 0);
  });

  it("ignores case and outer spaces in colors, without matching empty colors", () => {
    assert.equal(calculateColorScore(lost, { color: " BLACK " }), 10);
    assert.equal(calculateColorScore(lost, { color: "Blue" }), 0);
    assert.equal(calculateColorScore({ color: null }, { color: "" }), 0);
  });

  it("uses shared unique keywords and ignores common words and punctuation", () => {
    assert.equal(calculateDescriptionScore(lost, found), 15);
    assert.equal(calculateDescriptionScore(lost, { description: "The BLACK wallet, wallet!" }), 10);
    assert.equal(calculateDescriptionScore(lost, { description: "Blue phone" }), 0);
    assert.equal(calculateDescriptionScore({ description: "the and at" }, { description: "the" }), 0);
    assert.equal(calculateDescriptionScore({}, {}), 0);
  });

  it("adds the individual scores and produces a value from 0 to 100", () => {
    assert.equal(calculateFinalMatchScore(lost, found), 100);
    assert.equal(calculateFinalMatchScore(lost, { ...found, description: "Black wallet" }), 95);
    assert.equal(calculateFinalMatchScore({}, {}), 0);
    const different = { categoryId: "phone", locationId: "ground", color: "White", eventDate: "2026-12-10T14:00:00Z", description: "Small charger" };
    assert.equal(calculateFinalMatchScore(lost, different), 0);
  });

  it("never uses private identifying details to calculate a score", () => {
    const first = { ...lost, privateDetails: "Serial number 123456" };
    assert.equal(calculateFinalMatchScore(first, { ...found, privateDetails: "Unrelated secret" }), 100);
    assert.equal(calculateFinalMatchScore(first, { ...found, privateDetails: null }), 100);
  });
});
