
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reportFields = [
  "type", "title", "description", "categoryId", "locationId", "eventDate",
  "category", "location", "date", "color", "imageUrl", "categoryDetails",
  "locationDetails", "privateDetails", "status",
];
const reportStatuses = ["ACTIVE", "MATCHED", "RESOLVED", "CLOSED"];

function checkBody(body, allowedFields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Please send a JSON object.");
    error.statusCode = 400;
    throw error;
  }
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      const error = new Error(`Unknown field: ${field}.`);
      error.statusCode = 400;
      throw error;
    }
  }
}

function readString(body, field, maxLength) {
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    const error = new Error(`${field} is required and must be at most ${maxLength} characters.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function checkId(value, field) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.statusCode = 400;
    throw error;
  }
}

function readDate(value, field, dateOnly = false) {
  const datePart = typeof value === "string" ? value.slice(0, 10) : "";
  const day = new Date(`${datePart}T00:00:00.000Z`);
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    && !Number.isNaN(day.getTime())
    && day.toISOString().slice(0, 10) === datePart;
  const validFormat = typeof value === "string"
    && (dateOnly ? value === datePart : /^\d{4}-\d{2}-\d{2}T/.test(value));
  const date = new Date(dateOnly ? day : value);

  if (!validDay || !validFormat || Number.isNaN(date.getTime())) {
    const format = dateOnly ? "YYYY-MM-DD" : "ISO date and time";
    const error = new Error(`${field} must be a valid ${format}.`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function checkConflictingFields(body, first, second) {
  if (first in body && second in body) {
    const error = new Error(`Send either ${first} or ${second}, not both.`);
    error.statusCode = 400;
    throw error;
  }
}

export function readAuthInput(body, registration = false) {
  checkBody(body, registration ? ["name", "email", "password"] : ["email", "password"]);
  const email = readString(body, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Please provide a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  const password = body.password;
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must be at least 8 characters and at most 72 bytes.");
    error.statusCode = 400;
    throw error;
  }

  const data = { email, password };
  if (registration) {
    data.name = readString(body, "name", 100);
  }
  return data;
}

export function validateRegistration(req, res, next) {
  req.body = readAuthInput(req.body, true);
  next();
}

export function validateLogin(req, res, next) {
  req.body = readAuthInput(req.body);
  next();
}

export function validateReportId(req, res, next) {
  checkId(req.params.id, "id");
  next();
}

export function validateReport(req, res, next) {
  const body = req.body;
  const creating = req.method === "POST";
  checkBody(body, reportFields);
  if (!Object.keys(body).length) {
    const error = new Error("Please provide at least one report field.");
    error.statusCode = 400;
    throw error;
  }

  const data = {};
  for (const field of ["title", "description"]) {
    if (creating || field in body) {
      data[field] = readString(body, field, field === "title" ? 120 : 5000);
    }
  }

  for (const field of ["category", "location"]) {
    const idField = `${field}Id`;
    checkConflictingFields(body, field, idField);
    if (field in body) {
      data[field] = readString(body, field, 100);
    } else if (creating || idField in body) {
      checkId(body[idField], idField);
      data[idField] = body[idField];
    }
  }

  if (creating || "type" in body) {
    if (!["LOST", "FOUND"].includes(body.type)) {
      const error = new Error("type must be LOST or FOUND.");
      error.statusCode = 400;
      throw error;
    }
    data.type = body.type;
  }

  checkConflictingFields(body, "date", "eventDate");
  if ("date" in body) {
    data.eventDate = readDate(body.date, "date", true);
  } else if (creating || "eventDate" in body) {
    data.eventDate = readDate(body.eventDate, "eventDate");
  }

  for (const field of ["color", "categoryDetails", "locationDetails", "imageUrl", "privateDetails"]) {
    if (!(field in body)) continue;
    const value = body[field];
    const maxLength = field === "imageUrl" ? 2048 : field === "privateDetails" ? 5000 : field === "color" ? 50 : 500;
    if (value !== null && (typeof value !== "string" || value.trim().length > maxLength)) {
      const error = new Error(`${field} must be text of at most ${maxLength} characters, or null.`);
      error.statusCode = 400;
      throw error;
    }
    data[field] = value === null ? null : value.trim() || null;
  }

  if (data.imageUrl) {
    let url;
    try {
      url = new URL(data.imageUrl);
    } catch {
      const error = new Error("imageUrl must be a valid HTTP or HTTPS URL.");
      error.statusCode = 400;
      throw error;
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      const error = new Error("imageUrl must be a valid HTTP or HTTPS URL.");
      error.statusCode = 400;
      throw error;
    }
  }

  if ("status" in body) {
    if (req.user.role !== "ADMIN" && (creating || body.status !== "CLOSED")) {
      const error = new Error("You can only close your own report. Other status changes require an admin.");
      error.statusCode = 403;
      throw error;
    }
    if (!reportStatuses.includes(body.status)) {
      const error = new Error("status must be ACTIVE, MATCHED, RESOLVED, or CLOSED.");
      error.statusCode = 400;
      throw error;
    }
    data.status = body.status;
  }

  req.body = data;
  next();
}

export function validateReportQuery(req, res, next) {
  const query = req.query;
  const allowedFields = [
    "page", "limit", "type", "status", "categoryId", "locationId",
    "category", "location", "dateFrom", "dateTo", "q",
  ];
  for (const field of Object.keys(query)) {
    if (!allowedFields.includes(field)) {
      const error = new Error(`Unknown query parameter: ${field}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const page = query.page === undefined ? "1" : query.page;
  const limit = query.limit === undefined ? "20" : query.limit;
  for (const [field, value] of [["page", page], ["limit", limit]]) {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      const error = new Error(`${field} must be a positive whole number.`);
      error.statusCode = 400;
      throw error;
    }
  }
  // Keep the page size and offset within a sensible range.
  if (Number(limit) > 100 || (Number(page) - 1) * Number(limit) > 2147483647) {
    const error = new Error("limit must be at most 100 and page must be within range.");
    error.statusCode = 400;
    throw error;
  }

  const filters = {};
  if (query.type !== undefined) {
    if (!["LOST", "FOUND"].includes(query.type)) {
      const error = new Error("type must be LOST or FOUND.");
      error.statusCode = 400;
      throw error;
    }
    filters.type = query.type;
  }
  if (query.status !== undefined) {
    if (!reportStatuses.includes(query.status)) {
      const error = new Error("Invalid report status.");
      error.statusCode = 400;
      throw error;
    }
    filters.status = query.status;
  }
  for (const field of ["categoryId", "locationId"]) {
    if (query[field] !== undefined) {
      checkId(query[field], field);
      filters[field] = query[field];
    }
  }
  for (const field of ["category", "location"]) {
    checkConflictingFields(query, field, `${field}Id`);
    if (query[field] !== undefined) {
      filters[field] = readString(query, field, 100);
    }
  }
  if (query.q !== undefined) {
    filters.q = readString(query, "q", 200);
  }
  for (const field of ["dateFrom", "dateTo"]) {
    if (query[field] !== undefined) {
      filters[field] = readDate(query[field], field, true);
    }
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    const error = new Error("dateFrom must be on or before dateTo.");
    error.statusCode = 400;
    throw error;
  }
  req.reportQuery = { page: Number(page), limit: Number(limit), filters };
  next();
}

export function validateMatchQuery(req, res, next) {
  for (const field of Object.keys(req.query)) {
    if (!["page", "limit"].includes(field)) {
      const error = new Error(`Unknown query parameter: ${field}.`);
      error.statusCode = 400;
      throw error;
    }
  }
  validateReportQuery(req, res, next);
}
