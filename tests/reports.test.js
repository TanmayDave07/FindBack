import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

let prisma;
let server;
let baseUrl;
const users = {};
const tokens = {};
const categories = {};
const locations = {};
const createdCategoryIds = [];
const createdLocationIds = [];
const createdNearbyPairs = [];

function lostReport(changes = {}) {
  return {
    type: "LOST",
    title: "Black wallet",
    category: "Wallet",
    color: "Black",
    location: "Library",
    date: "2026-11-10",
    description: "Black leather wallet",
    ...changes,
  };
}

async function request(method, path, body, actor = "owner") {
  const headers = {};
  if (actor) headers.Authorization = `Bearer ${tokens[actor]}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data };
}

async function createReport(changes = {}, actor = "owner") {
  const response = await request("POST", "/api/reports", lostReport(changes), actor);
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.report;
}

async function listReports(query = "", actor = "owner") {
  const response = await request("GET", `/api/reports${query ? `?${query}` : ""}`, undefined, actor);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}

async function getMatches(reportId, actor = "owner", query = "") {
  const response = await request("GET", `/api/reports/${reportId}/matches${query ? `?${query}` : ""}`, undefined, actor);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}

async function createMatchingPair() {
  const lost = await createReport({ date: undefined, eventDate: "2026-11-10T14:00:00Z" });
  const found = await createReport({ type: "FOUND", date: undefined, eventDate: "2026-11-10T14:30:00Z" }, "other");
  return { lost, found };
}

describe("Lost and found reporting", { concurrency: false }, () => {
  before(async () => {
    // Never run these tests against the database configured in .env.
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("Set TEST_DATABASE_URL to an isolated PostgreSQL test database.");
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
    process.env.JWT_EXPIRES_IN = "1h";

    prisma = (await import("../src/config/db.js")).default;
    const app = (await import("../src/app.js")).default;
    await prisma.$connect();
    if (await prisma.itemReport.count()) {
      throw new Error("The test database must have no existing reports. Nothing was deleted.");
    }

    for (const name of ["Wallet", "Phone"]) {
      let category = await prisma.category.findUnique({ where: { name } });
      if (!category) {
        category = await prisma.category.create({ data: { name } });
        createdCategoryIds.push(category.id);
      }
      categories[name] = category;
    }
    for (const name of ["Library", "Main Ground"]) {
      let location = await prisma.location.findUnique({ where: { name } });
      if (!location) {
        location = await prisma.location.create({ data: { name } });
        createdLocationIds.push(location.id);
      }
      locations[name] = location;
    }

    const passwordHash = await bcrypt.hash("TestPassword123!", 12);
    for (const actor of ["owner", "other", "admin"]) {
      users[actor] = await prisma.user.create({
        data: {
          name: `Report test ${actor}`,
          email: `${actor}-${randomUUID()}@example.com`,
          passwordHash,
          role: actor === "admin" ? "ADMIN" : "STUDENT",
        },
      });
      tokens[actor] = jwt.sign({}, process.env.JWT_SECRET, {
        subject: users[actor].id,
        algorithm: "HS256",
        expiresIn: "1h",
      });
    }

    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (!prisma || !Object.keys(users).length) return;
    await prisma.claim.deleteMany({
      where: { userId: { in: Object.values(users).map((user) => user.id) } },
    });
    // These users were created by this suite, so only their reports are removed.
    await prisma.itemReport.deleteMany({
      where: { userId: { in: Object.values(users).map((user) => user.id) } },
    });
    for (const pair of createdNearbyPairs) {
      await prisma.nearbyLocation.deleteMany({ where: pair });
    }
    createdNearbyPairs.length = 0;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (!prisma) return;
    try {
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      await prisma.location.deleteMany({ where: { id: { in: createdLocationIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("requires login before viewing or creating reports", async () => {
    for (const [method, path, body] of [
      ["GET", "/api/reports", undefined],
      ["POST", "/api/reports", lostReport()],
      ["GET", `/api/reports/${randomUUID()}`, undefined],
    ]) {
      const response = await request(method, path, body, null);
      assert.equal(response.status, 401);
    }
  });

  it("accepts the simple lost-report example and returns category and location details", async () => {
    const report = await createReport({ category: "wallet", location: "library" });
    assert.equal(report.type, "LOST");
    assert.equal(report.title, "Black wallet");
    assert.equal(report.userId, users.owner.id);
    assert.equal(report.category.id, categories.Wallet.id);
    assert.equal(report.category.name, "Wallet");
    assert.equal(report.location.id, locations.Library.id);
    assert.equal(report.location.name, "Library");
    assert.equal(report.eventDate, "2026-11-10T00:00:00.000Z");
    assert.equal(report.status, "ACTIVE");

    const list = await listReports("type=LOST", "other");
    assert.equal(list.total, 1);
    assert.equal(list.reports[0].id, report.id);
    assert.equal(list.reports[0].user.name, users.owner.name);
    assert.equal("email" in list.reports[0].user, false);
  });

  it("still accepts category IDs, location IDs and an exact found date and time", async () => {
    const response = await request("POST", "/api/reports", {
      type: "FOUND",
      title: "Found phone",
      description: "A phone near the main ground",
      categoryId: categories.Phone.id,
      locationId: locations["Main Ground"].id,
      eventDate: "2026-11-11T16:30:00Z",
      locationDetails: "Beside the entrance",
    });
    assert.equal(response.status, 201, JSON.stringify(response.data));
    assert.equal(response.data.report.type, "FOUND");
    assert.equal(response.data.report.eventDate, "2026-11-11T16:30:00.000Z");
    assert.equal(response.data.report.locationDetails, "Beside the entrance");

    const list = await listReports("type=FOUND");
    assert.equal(list.total, 1);
    assert.equal(list.reports[0].id, response.data.report.id);
  });

  it("combines filters and includes the entire first and last date", async () => {
    const first = await createReport();
    const last = await createReport({ date: undefined, eventDate: "2026-11-12T23:59:59.999Z" });
    await createReport({ date: "2026-11-09" });
    await createReport({ date: "2026-11-13" });
    await createReport({ type: "FOUND" });
    await createReport({ category: "Phone" });
    await createReport({ location: "Main Ground" });
    const closed = await createReport();
    assert.equal((await request("POST", `/api/reports/${closed.id}/close`, {})).status, 200);

    const query = "type=LOST&status=ACTIVE&category=wallet&location=library&dateFrom=2026-11-10&dateTo=2026-11-12&q=LEATHER";
    const list = await listReports(query);
    assert.equal(list.total, 2);
    assert.deepEqual(new Set(list.reports.map((report) => report.id)), new Set([first.id, last.id]));

    const ids = await listReports(`categoryId=${categories.Wallet.id}&locationId=${locations.Library.id}&type=FOUND`);
    assert.equal(ids.total, 1);
  });

  it("searches public title, description, color, category and location without case sensitivity", async () => {
    const report = await createReport({ title: "Missing item", description: "Dropped after class", color: "Purple" });
    await createReport({ title: "Another item", description: "Different item", color: "Blue", category: "Phone", location: "Main Ground" });
    for (const keyword of ["MISSING", "CLASS", "purple", "wallet", "library"]) {
      const list = await listReports(`q=${keyword}`);
      assert.equal(list.total, 1, keyword);
      assert.equal(list.reports[0].id, report.id, keyword);
    }
    const marked = await createReport({ title: "Label 50%_A\\B" });
    for (const keyword of ["%", "_", "\\"]) {
      const list = await listReports(`q=${encodeURIComponent(keyword)}`);
      assert.equal(list.total, 1, keyword);
      assert.equal(list.reports[0].id, marked.id, keyword);
    }
  });

  it("paginates with an accurate total and a stable order when creation times match", async () => {
    const reports = [];
    for (let number = 1; number <= 5; number++) {
      reports.push(await createReport({ title: `Wallet ${number}` }));
    }
    await prisma.itemReport.updateMany({
      where: { id: { in: reports.map((report) => report.id) } },
      data: { createdAt: new Date("2026-11-15T12:00:00Z") },
    });
    const expectedIds = reports.map((report) => report.id).sort().reverse();
    const first = await listReports("page=1&limit=2");
    const second = await listReports("page=2&limit=2");
    const third = await listReports("page=3&limit=2");
    assert.equal(first.total, 5);
    assert.equal(second.page, 2);
    assert.equal(second.limit, 2);
    assert.deepEqual([...first.reports, ...second.reports, ...third.reports].map((report) => report.id), expectedIds);
    assert.deepEqual((await listReports("page=2&limit=2")).reports.map((report) => report.id), expectedIds.slice(2, 4));
    assert.equal((await listReports("page=4&limit=2")).reports.length, 0);
  });

  it("lets owners update and close lost and found reports, but reserves other status changes for admins", async () => {
    for (const type of ["LOST", "FOUND"]) {
      const report = await createReport({ type });
      const updated = await request("PATCH", `/api/reports/${report.id}`, { title: "Updated item", category: "phone", location: "main ground", date: "2026-11-12" });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      assert.equal(updated.data.report.title, "Updated item");
      assert.equal(updated.data.report.category.name, "Phone");
      assert.equal(updated.data.report.location.name, "Main Ground");
      const closed = await request("POST", `/api/reports/${report.id}/close`, {});
      assert.equal(closed.status, 200, JSON.stringify(closed.data));
      assert.equal(closed.data.report.status, "CLOSED");
      assert.equal((await request("PATCH", `/api/reports/${report.id}`, { status: "ACTIVE" })).status, 403);
      assert.equal((await request("PATCH", `/api/reports/${report.id}`, { status: "RESOLVED" })).status, 403);
    }
    const report = await createReport();
    const closed = await request("PATCH", `/api/reports/${report.id}`, { status: "CLOSED" });
    assert.equal(closed.status, 200);
    assert.equal(closed.data.report.status, "CLOSED");
  });

  it("blocks other users from changing reports and lets admins manage them", async () => {
    const report = await createReport({ type: "FOUND" });
    for (const [method, path, body] of [
      ["PATCH", `/api/reports/${report.id}`, { title: "Not my report" }],
      ["PATCH", `/api/reports/${report.id}`, { status: "CLOSED" }],
      ["POST", `/api/reports/${report.id}/close`, {}],
      ["DELETE", `/api/reports/${report.id}`, undefined],
    ]) {
      assert.equal((await request(method, path, body, "other")).status, 403);
    }
    for (const status of ["MATCHED", "RESOLVED", "CLOSED", "ACTIVE"]) {
      const response = await request("PATCH", `/api/reports/${report.id}`, { status }, "admin");
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.equal(response.data.report.status, status);
    }
    assert.equal((await request("DELETE", `/api/reports/${report.id}`, undefined, "admin")).status, 204);
    assert.equal((await request("GET", `/api/reports/${report.id}`)).status, 404);
  });

  it("keeps identifying details private in every response and excludes them from keyword search", async () => {
    const secret = "SecretSerial983471";
    const report = await createReport({ type: "FOUND", privateDetails: secret });
    assert.equal(report.privateDetails, secret);

    for (const actor of ["owner", "admin"]) {
      const detail = await request("GET", `/api/reports/${report.id}`, undefined, actor);
      assert.equal(detail.data.report.privateDetails, secret);
      assert.equal((await listReports("type=FOUND", actor)).reports[0].privateDetails, secret);
    }
    const otherDetail = await request("GET", `/api/reports/${report.id}`, undefined, "other");
    assert.equal(otherDetail.status, 200);
    assert.equal("privateDetails" in otherDetail.data.report, false);
    assert.equal("privateDetails" in (await listReports("type=FOUND", "other")).reports[0], false);
    for (const actor of ["owner", "other", "admin"]) {
      assert.equal((await listReports(`q=${secret}`, actor)).total, 0);
    }

    const updated = await request("PATCH", `/api/reports/${report.id}`, { privateDetails: "New private mark" });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.report.privateDetails, "New private mark");
    assert.equal("privateDetails" in (await request("GET", `/api/reports/${report.id}`, undefined, "other")).data.report, false);
    const cleared = await request("PATCH", `/api/reports/${report.id}`, { privateDetails: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.report.privateDetails, null);
  });

  it("rejects invalid reports, unknown names and conflicting inputs", async () => {
    for (const changes of [
      { category: "Unknown category" },
      { location: "Unknown location" },
      { category: "Wal%" },
      { category: "Walle_" },
      { location: "%" },
      { location: "Librar_" },
      { date: "2026-02-30" },
      { date: "2026-13-10" },
      { date: "not-a-date" },
      { date: undefined, eventDate: "2026-02-30T12:00:00Z" },
      { categoryId: categories.Wallet.id },
      { locationId: locations.Library.id },
      { eventDate: "2026-11-10T12:00:00Z" },
      { userId: users.other.id },
      { type: "OTHER" },
      { title: " " },
    ]) {
      const response = await request("POST", "/api/reports", lostReport(changes));
      assert.equal(response.status, 400, JSON.stringify(changes));
    }
    const missingId = await request("POST", "/api/reports", {
      type: "LOST", title: "Wallet", description: "Missing wallet",
      categoryId: randomUUID(), locationId: locations.Library.id, eventDate: "2026-11-10T12:00:00Z",
    });
    assert.equal(missingId.status, 400);
    assert.equal((await listReports()).total, 0);
  });

  it("rejects invalid filters and pagination before querying reports", async () => {
    for (const query of [
      "dateFrom=2026-02-30", "dateTo=2026-13-10", "dateFrom=2026-11-12&dateTo=2026-11-10",
      "type=OTHER", "status=OTHER", "page=0", "limit=101", "page=1.5",
      "page=999999999999999999", "q=wallet&q=phone", "unknown=value",
      `category=Wallet&categoryId=${categories.Wallet.id}`,
      `location=Library&locationId=${locations.Library.id}`,
    ]) {
      const response = await request("GET", `/api/reports?${query}`);
      assert.equal(response.status, 400, query);
    }
  });

  it("treats SQL-looking keyword text as data and leaves reports intact", async () => {
    const report = await createReport();
    const keyword = "wallet' OR 1=1; DROP TABLE \"ItemReport\"; --";
    const list = await listReports(`q=${encodeURIComponent(keyword)}`);
    assert.equal(list.total, 0);
    assert.equal((await listReports()).total, 1);
    assert.equal((await request("GET", `/api/reports/${report.id}`)).status, 200);
  });

  it("automatically stores a match and shows it to both report owners", async () => {
    const { lost, found } = await createMatchingPair();
    const matches = await getMatches(lost.id);
    assert.equal(matches.total, 1);
    assert.equal(matches.matches[0].score, 100);
    assert.equal(matches.matches[0].report.id, found.id);
    assert.equal(matches.matches[0].report.category.name, "Wallet");
    const reverse = await getMatches(found.id, "other");
    assert.equal(reverse.matches[0].id, matches.matches[0].id);
    assert.equal(reverse.matches[0].report.id, lost.id);
    const stored = await prisma.match.findUnique({ where: { id: matches.matches[0].id } });
    assert.equal(stored.lostReportId, lost.id);
    assert.equal(stored.foundReportId, found.id);
    assert.equal(stored.status, "PENDING");
  });

  it("also matches when the found report is created first", async () => {
    const found = await createReport({ type: "FOUND" }, "other");
    const lost = await createReport();
    const matches = await getMatches(lost.id);
    assert.equal(matches.total, 1);
    assert.equal(matches.matches[0].report.id, found.id);
    assert.equal(await prisma.match.count(), 1);
  });

  it("excludes same-type, different-category and ineligible reports", async () => {
    const lost = await createReport();
    await createReport();
    await createReport({ type: "FOUND", category: "Phone" });
    for (const status of ["CLOSED", "RESOLVED", "MATCHED"]) {
      const found = await createReport({ type: "FOUND" });
      assert.equal((await request("PATCH", `/api/reports/${found.id}`, { status }, "admin")).status, 200);
    }
    const active = await createReport({ type: "FOUND" });
    const matches = await getMatches(lost.id);
    assert.equal(matches.total, 1);
    assert.equal(matches.matches[0].report.id, active.id);
    const rows = await prisma.match.findMany({ include: { lostReport: true, foundReport: true } });
    for (const row of rows) {
      assert.equal(row.lostReport.type, "LOST");
      assert.equal(row.foundReport.type, "FOUND");
      assert.equal(row.lostReport.categoryId, row.foundReport.categoryId);
    }
  });

  it("ranks matches by score, applies the cutoff and paginates with an accurate total", async () => {
    const lost = await createReport({ date: undefined, eventDate: "2026-11-10T14:00:00Z" });
    await createReport({ type: "FOUND", date: undefined, eventDate: "2026-11-10T14:30:00Z" });
    await createReport({ type: "FOUND", date: undefined, eventDate: "2026-11-10T14:30:00Z", description: "Black wallet" });
    await createReport({ type: "FOUND", date: undefined, eventDate: "2026-11-10T14:30:00Z", location: "Main Ground" });
    await createReport({ type: "FOUND", date: undefined, eventDate: "2026-11-10T14:30:00Z", location: "Main Ground", color: null, description: "Different item" });
    await createReport({ type: "FOUND", date: "2026-10-01", location: "Main Ground", color: "White", description: "Different item" });
    const first = await getMatches(lost.id, "owner", "page=1&limit=2");
    const second = await getMatches(lost.id, "owner", "page=2&limit=2");
    assert.equal(first.total, 4);
    assert.equal(second.total, 4);
    assert.deepEqual([...first.matches, ...second.matches].map((match) => match.score), [100, 95, 75, 50]);
    assert.equal((await getMatches(lost.id, "owner", "page=3&limit=2")).matches.length, 0);
  });

  it("awards nearby-location points from a manually stored pair in both directions", async () => {
    const pair = { locationId: locations.Library.id, nearbyLocationId: locations["Main Ground"].id };
    await prisma.nearbyLocation.create({ data: pair });
    createdNearbyPairs.push(pair);
    const lost = await createReport();
    const found = await createReport({ type: "FOUND", location: "Main Ground" });
    assert.equal((await getMatches(lost.id)).matches[0].score, 90);
    const otherLost = await createReport({ location: "Main Ground" });
    const otherFound = await createReport({ type: "FOUND" });
    const matches = await getMatches(otherLost.id);
    assert.equal(matches.matches.find((match) => match.report.id === otherFound.id).score, 90);
    assert.equal((await getMatches(found.id)).total, 2);
  });

  it("recalculates relevant edits, invalidates stale pairs and reuses their stored IDs", async () => {
    const { lost, found } = await createMatchingPair();
    const original = (await getMatches(lost.id)).matches[0];
    for (const [changes, score] of [
      [{ color: "White" }, 90],
      [{ color: "Black", description: "Different item" }, 85],
      [{ description: "Black leather wallet", eventDate: "2026-11-18T14:00:00Z" }, 80],
      [{ eventDate: "2026-11-10T14:30:00Z", location: "Main Ground" }, 75],
    ]) {
      assert.equal((await request("PATCH", `/api/reports/${found.id}`, changes, "other")).status, 200);
      const matches = await getMatches(lost.id);
      assert.equal(matches.matches[0].score, score);
      assert.equal(matches.matches[0].id, original.id);
    }
    for (const changes of [{ category: "Phone" }, { category: "Wallet", type: "LOST" }]) {
      assert.equal((await request("PATCH", `/api/reports/${found.id}`, changes, "other")).status, 200);
      assert.equal((await getMatches(lost.id)).total, 0);
      assert.equal((await prisma.match.findUnique({ where: { id: original.id } })).status, "INVALIDATED");
    }
    await request("PATCH", `/api/reports/${found.id}`, { type: "FOUND", location: "Library" }, "other");
    assert.equal((await getMatches(lost.id)).matches[0].id, original.id);
    assert.equal((await getMatches(lost.id)).matches[0].score, 100);
    assert.equal(await prisma.match.count(), 1);
  });

  it("invalidates matches when either report closes or becomes resolved or matched", async () => {
    const { lost, found } = await createMatchingPair();
    const originalId = (await getMatches(lost.id)).matches[0].id;
    for (const report of [lost, found]) {
      for (const status of ["CLOSED", "RESOLVED", "MATCHED"]) {
        assert.equal((await request("PATCH", `/api/reports/${report.id}`, { status }, "admin")).status, 200);
        assert.equal((await getMatches(lost.id)).total, 0);
        assert.equal((await getMatches(found.id, "other")).total, 0);
        assert.equal((await prisma.match.findUnique({ where: { id: originalId } })).status, "INVALIDATED");
        await request("PATCH", `/api/reports/${report.id}`, { status: "ACTIVE" }, "admin");
        assert.equal((await getMatches(lost.id)).matches[0].id, originalId);
      }
    }
    assert.equal((await request("POST", `/api/reports/${lost.id}/close`, {})).status, 200);
    assert.equal((await getMatches(found.id, "other")).total, 0);
  });

  it("keeps private details out of suggestions and does not rescore private-only edits", async () => {
    const { lost, found } = await createMatchingPair();
    const matchId = (await getMatches(lost.id)).matches[0].id;
    const before = await prisma.match.findUnique({ where: { id: matchId } });
    await request("PATCH", `/api/reports/${found.id}`, { privateDetails: "Private serial number" }, "other");
    const matches = await getMatches(lost.id);
    assert.equal("privateDetails" in matches.matches[0].report, false);
    assert.equal(matches.matches[0].score, 100);
    const after = await prisma.match.findUnique({ where: { id: matchId } });
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
    assert.equal((await getMatches(lost.id, "admin")).matches[0].report.privateDetails, "Private serial number");
    assert.equal((await request("GET", `/api/reports/${lost.id}/matches`, undefined, "other")).status, 403);
    assert.equal((await request("GET", `/api/reports/${lost.id}/matches`, undefined, null)).status, 401);
    for (const query of ["q=wallet", "page=0", "limit=101", "page=1&page=2"]) {
      assert.equal((await request("GET", `/api/reports/${lost.id}/matches?${query}`)).status, 400);
    }
  });

  it("preserves rejected and confirmed decisions and keeps claim references when invalidating", async () => {
    const { lost, found } = await createMatchingPair();
    const matchId = (await getMatches(lost.id)).matches[0].id;
    await prisma.match.update({ where: { id: matchId }, data: { status: "DISMISSED" } });
    await request("PATCH", `/api/reports/${found.id}`, { color: "White" }, "other");
    assert.equal((await getMatches(lost.id)).total, 0);
    assert.equal((await prisma.match.findUnique({ where: { id: matchId } })).status, "DISMISSED");
    await prisma.match.update({ where: { id: matchId }, data: { status: "CONFIRMED" } });
    await request("PATCH", `/api/reports/${found.id}`, { color: "Black" }, "other");
    assert.equal((await prisma.match.findUnique({ where: { id: matchId } })).status, "CONFIRMED");
    const claim = await prisma.claim.create({ data: {
      userId: users.owner.id, foundReportId: found.id, matchId, message: "This is my wallet",
    } });
    await request("POST", `/api/reports/${found.id}/close`, {}, "other");
    assert.equal((await prisma.match.findUnique({ where: { id: matchId } })).status, "INVALIDATED");
    assert.equal((await prisma.claim.findUnique({ where: { id: claim.id } })).matchId, matchId);
  });

  it("rebuilds suggestions for existing reports and safely reruns without duplicates", async () => {
    const data = {
      title: "Black wallet", description: "Black leather wallet", color: "Black",
      categoryId: categories.Wallet.id, locationId: locations.Library.id,
      eventDate: new Date("2026-11-10T14:00:00Z"),
    };
    const lost = await prisma.itemReport.create({ data: { ...data, userId: users.owner.id, type: "LOST" } });
    await prisma.itemReport.create({ data: { ...data, userId: users.other.id, type: "FOUND" } });
    assert.equal((await getMatches(lost.id)).total, 0);
    const run = promisify(execFile);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await run(process.execPath, ["scripts/rebuildMatches.js"], { cwd: new URL("../", import.meta.url) });
      assert.match(result.stdout, /1 potential matches stored/);
      assert.equal((await getMatches(lost.id)).total, 1);
      assert.equal(await prisma.match.count(), 1);
    }
  });

  it("handles simultaneous lost/found submissions and a concurrent close safely", async () => {
    const [lost, found] = await Promise.all([
      createReport(), createReport({ type: "FOUND" }, "other"),
    ]);
    assert.equal((await getMatches(lost.id)).total, 1);
    assert.equal(await prisma.match.count(), 1);
    await Promise.all([
      request("POST", `/api/reports/${lost.id}/close`, {}),
      createReport({ type: "FOUND" }, "other"),
    ]);
    assert.equal((await getMatches(found.id, "other")).total, 0);
    assert.equal(await prisma.match.count({ where: { status: "PENDING" } }), 0);
  });

  it("removes match rows when their report is deleted", async () => {
    const { lost, found } = await createMatchingPair();
    assert.equal(await prisma.match.count(), 1);
    assert.equal((await request("DELETE", `/api/reports/${found.id}`, undefined, "other")).status, 204);
    assert.equal((await getMatches(lost.id)).total, 0);
    assert.equal(await prisma.match.count(), 0);
  });
});
