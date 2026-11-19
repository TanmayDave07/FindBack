import prisma from "../config/db.js";
import { Prisma } from "@prisma/client";

const reportDetails = {
  category: true,
  location: true,
  user: { select: { id: true, name: true } },
};

async function resolveReferences(body) {
  const { category: categoryName, location: locationName, ...data } = body;
  if (categoryName !== undefined || data.categoryId) {
    let category;
    if (categoryName !== undefined) {
      const categories = await prisma.$queryRaw`
        SELECT "id" FROM "Category" WHERE LOWER("name") = LOWER(${categoryName})
      `;
      category = categories[0];
    } else {
      category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    }
    if (!category) {
      const error = new Error("Category does not exist.");
      error.statusCode = 400;
      throw error;
    }
    data.categoryId = category.id;
  }
  if (locationName !== undefined || data.locationId) {
    let location;
    if (locationName !== undefined) {
      const locations = await prisma.$queryRaw`
        SELECT "id" FROM "Location" WHERE LOWER("name") = LOWER(${locationName})
      `;
      location = locations[0];
    } else {
      location = await prisma.location.findUnique({ where: { id: data.locationId } });
    }
    if (!location) {
      const error = new Error("Location does not exist.");
      error.statusCode = 400;
      throw error;
    }
    data.locationId = location.id;
  }
  return data;
}

async function findReport(id) {
  const report = await prisma.itemReport.findUnique({
    where: { id },
    include: reportDetails,
  });
  if (!report) {
    const error = new Error("Report not found.");
    error.statusCode = 404;
    throw error;
  }
  return report;
}

function checkOwner(user, report) {
  if (user.role !== "ADMIN" && report.userId !== user.id) {
    const error = new Error("You can only change your own reports.");
    error.statusCode = 403;
    throw error;
  }
}

function visibleReport(report, user) {
  const result = { ...report };
  if (user.role !== "ADMIN" && report.userId !== user.id) {
    delete result.privateDetails;
  }
  return result;
}

export async function getReports(req, res) {
  const { page, limit, filters } = req.reportQuery;
  const conditions = [];
  if (filters.type) conditions.push(Prisma.sql`r."type" = ${filters.type}::"ItemType"`);
  if (filters.status) conditions.push(Prisma.sql`r."status" = ${filters.status}::"ReportStatus"`);
  if (filters.categoryId) conditions.push(Prisma.sql`r."categoryId" = ${filters.categoryId}`);
  if (filters.locationId) conditions.push(Prisma.sql`r."locationId" = ${filters.locationId}`);
  if (filters.category) conditions.push(Prisma.sql`LOWER(c."name") = LOWER(${filters.category})`);
  if (filters.location) conditions.push(Prisma.sql`LOWER(l."name") = LOWER(${filters.location})`);
  // Compare UTC text as a timestamp, matching the column's stored UTC values.
  if (filters.dateFrom) conditions.push(Prisma.sql`r."eventDate" >= ${filters.dateFrom.toISOString()}::timestamp`);
  if (filters.dateTo) {
    // Include the whole last day, up to the start of the following day (UTC).
    const nextDay = new Date(filters.dateTo);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    conditions.push(Prisma.sql`r."eventDate" < ${nextDay.toISOString()}::timestamp`);
  }
  if (filters.q) {
    // Escape LIKE wildcards so %, _ and backslashes are treated as normal text.
    const keyword = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`(
      r."title" ILIKE ${keyword} OR r."description" ILIKE ${keyword}
      OR r."color" ILIKE ${keyword} OR c."name" ILIKE ${keyword}
      OR l."name" ILIKE ${keyword}
    )`);
  }

  // Prisma.sql sends values separately from the SQL, keeping user input safe.
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw`
      SELECT r.*, c."name" AS "categoryName", c."createdAt" AS "categoryCreatedAt",
             l."name" AS "locationName", l."description" AS "locationDescription",
             u."name" AS "userName"
      FROM "ItemReport" r
      JOIN "Category" c ON r."categoryId" = c."id"
      JOIN "Location" l ON r."locationId" = l."id"
      JOIN "User" u ON r."userId" = u."id"
      ${where}
      ORDER BY r."createdAt" DESC, r."id" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM "ItemReport" r
      JOIN "Category" c ON r."categoryId" = c."id"
      JOIN "Location" l ON r."locationId" = l."id"
      ${where}
    `,
  ]);
  const reports = rows.map((row) => {
    const { categoryName, categoryCreatedAt, locationName, locationDescription, userName, ...report } = row;
    return {
      ...visibleReport(report, req.user),
      category: { id: report.categoryId, name: categoryName, createdAt: categoryCreatedAt },
      location: { id: report.locationId, name: locationName, description: locationDescription },
      user: { id: report.userId, name: userName },
    };
  });
  res.json({ reports, page, limit, total: Number(counts[0].total) });
}

export async function getReport(req, res) {
  const report = await findReport(req.params.id);
  res.json({ report: visibleReport(report, req.user) });
}

export async function createReport(req, res) {
  const data = await resolveReferences(req.body);
  const report = await prisma.itemReport.create({
    data: { ...data, userId: req.user.id },
    include: reportDetails,
  });
  res.status(201).json({ report: visibleReport(report, req.user) });
}

export async function updateReport(req, res) {
  const existingReport = await findReport(req.params.id);
  checkOwner(req.user, existingReport);
  const data = await resolveReferences(req.body);
  const report = await prisma.itemReport.update({
    where: { id: req.params.id },
    data,
    include: reportDetails,
  });
  res.json({ report: visibleReport(report, req.user) });
}

export async function closeReport(req, res) {
  const existingReport = await findReport(req.params.id);
  checkOwner(req.user, existingReport);
  const report = await prisma.itemReport.update({
    where: { id: req.params.id },
    data: { status: "CLOSED" },
    include: reportDetails,
  });
  res.json({ report: visibleReport(report, req.user) });
}

export async function deleteReport(req, res) {
  const report = await findReport(req.params.id);
  checkOwner(req.user, report);
  const claim = await prisma.claim.findFirst({
    where: { foundReportId: report.id },
    select: { id: true },
  });
  if (claim) {
    const error = new Error("This record is linked to other records.");
    error.statusCode = 409;
    throw error;
  }
  await prisma.itemReport.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
