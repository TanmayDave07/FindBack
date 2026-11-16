import prisma from "../config/db.js";

const reportDetails = {
  category: true,
  location: true,
  user: { select: { id: true, name: true } },
};

async function checkReferences(data) {
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      const error = new Error("Category does not exist.");
      error.statusCode = 400;
      throw error;
    }
  }
  if (data.locationId) {
    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) {
      const error = new Error("Location does not exist.");
      error.statusCode = 400;
      throw error;
    }
  }
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

export async function getReports(req, res) {
  const { page, limit, where } = req.reportQuery;
  const [reports, total] = await prisma.$transaction([
    prisma.itemReport.findMany({
      where,
      include: reportDetails,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.itemReport.count({ where }),
  ]);
  res.json({ reports, page, limit, total });
}

export async function getReport(req, res) {
  res.json({ report: await findReport(req.params.id) });
}

export async function createReport(req, res) {
  await checkReferences(req.body);
  const report = await prisma.itemReport.create({
    data: { ...req.body, userId: req.user.id },
    include: reportDetails,
  });
  res.status(201).json({ report });
}

export async function updateReport(req, res) {
  const existingReport = await findReport(req.params.id);
  checkOwner(req.user, existingReport);
  await checkReferences(req.body);
  const report = await prisma.itemReport.update({
    where: { id: req.params.id },
    data: req.body,
    include: reportDetails,
  });
  res.json({ report });
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
