# FindBack backend

A campus lost-and-found API written in plain JavaScript with Express,
PostgreSQL, Prisma, bcrypt, and JWT. Node.js 22 or newer is recommended.

## Setup

Run these commands inside the `FindBack` folder:

```bash
npm install
cp .env.example .env
```

If you already have a `.env`, keep it and add missing settings from `.env.example`.
Set `DATABASE_URL` and `DIRECT_URL` to your PostgreSQL URLs. For Neon, use the
pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`. For local
PostgreSQL, both can be the same. Create the database before running migrations.

Generate a secret, then paste the result into `JWT_SECRET` in `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs at `http://localhost:3000`. `npm start` runs without automatic
restarts. The server validates environment settings and connects to PostgreSQL
before accepting requests. Set `CORS_ORIGIN` to your frontend URL.

The existing seed supplies categories and campus locations. It also removes
obsolete locations that have no reports, and stops if an obsolete location
is still used by a report.

## Authentication

Register with `POST /api/auth/register`:

```json
{
  "name": "Asha",
  "email": "asha@example.com",
  "password": "MyPassword123!"
}
```

Log in with `POST /api/auth/login`:

```json
{
  "email": "asha@example.com",
  "password": "MyPassword123!"
}
```

Both return `{ "user": { ... }, "token": "..." }`. Passwords are hashed with
bcrypt and hashes are never returned. Emails are trimmed and stored in lowercase.
Passwords must be at least 8 characters and at most 72 UTF-8 bytes.

Send the token on protected requests:

```text
Authorization: Bearer YOUR_TOKEN
```

Registration always creates a `STUDENT`. Supplying `role` or any unknown field
is rejected. Tokens expire after `JWT_EXPIRES_IN` (default: `1d`). The current
user and role are checked in PostgreSQL on every authenticated request.

## Create the first admin

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in your local `.env`, then run:

```bash
npm run create-admin
```

Use a new email that does not already have an account. This command creates an
admin with a hashed password. Remove `ADMIN_PASSWORD` from `.env` afterward.
Admins use the same login endpoint as students.

## Routes and permissions

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Logged-in user |
| GET | `/api/categories` | Logged-in user |
| GET | `/api/locations` | Logged-in user |
| GET | `/api/reports` | Logged-in user |
| GET | `/api/reports/:id` | Logged-in user |
| POST | `/api/reports` | Logged-in user |
| PATCH | `/api/reports/:id` | Report owner or admin |
| POST | `/api/reports/:id/close` | Report owner or admin |
| DELETE | `/api/reports/:id` | Report owner or admin |
| GET | `/api/admin/users` | Admin only |

Students can change and close their own reports. Admins can change any report
and set any report status.
A student requesting an admin route receives `403 Forbidden`. Requests without
a valid token receive `401 Unauthorized`.

## Reports

Create a lost report with `POST /api/reports`:

```json
{
  "type": "LOST",
  "title": "Black wallet",
  "category": "Wallet",
  "color": "Black",
  "location": "Library",
  "date": "2026-11-10",
  "description": "Black leather wallet"
}
```

Use `type: "FOUND"` for a found item. Both types share the same routes.
Required fields are `type`, `title`, `description`, a category, a location,
and the date the item was lost or found. Category and location names must already
exist and are matched without case sensitivity. Get the available choices from
`/api/categories` and `/api/locations`. The seed includes `Wallet` and `Library`.

The previous format still works: use `categoryId` instead of `category`,
`locationId` instead of `location`, and `eventDate` instead of `date`.
Send one form of each field. `date` accepts `YYYY-MM-DD` and is stored at midnight
UTC. Use `eventDate`, such as `2026-11-10T14:30:00Z`, to record an exact time.

Optional fields are `color`, `imageUrl` (HTTP/HTTPS URL), `categoryDetails`,
`locationDetails` (floor, room, or nearby landmark), and `privateDetails`.
Send `null` to clear optional fields. The server sets the owner from the logged-in
account; callers cannot supply `userId`.

For a found item, put serial numbers, wallet contents, personal information,
or distinguishing marks used to prove ownership in `privateDetails`. Only the
report owner and admins can read that field. It is omitted for other users,
including in report lists, and is never used in keyword searches. Titles,
descriptions, images, and location details are visible to other logged-in users,
so keep identifying information out of those fields.

`PATCH /api/reports/:id` accepts only fields being changed. Owners can change
their report details and set `status` to `CLOSED`. Admins may set `status` to
`ACTIVE`, `MATCHED`, `RESOLVED`, or `CLOSED`. A report linked to a claim cannot
be deleted and returns `409 Conflict`.

To close a report without deleting its history, send:

```text
POST /api/reports/REPORT_UUID/close
```

No request body is needed. The owner or an admin can close it. Closing an already
closed report returns the same closed report.

List reports with optional filters:

```text
GET /api/reports?type=LOST&status=ACTIVE&category=Wallet&location=Library&dateFrom=2026-11-10&dateTo=2026-11-12&q=black&page=1&limit=20
```

All filters are optional and can be combined:

| Parameter | Meaning |
| --- | --- |
| `type` | `LOST` or `FOUND` |
| `status` | `ACTIVE`, `MATCHED`, `RESOLVED`, or `CLOSED` |
| `category` / `categoryId` | Category name or UUID; send one |
| `location` / `locationId` | Location name or UUID; send one |
| `dateFrom` / `dateTo` | First and last date, in `YYYY-MM-DD`; either can be used alone |
| `q` | Text found in title, description, color, category name, or location name |
| `page` / `limit` | Page number and number of reports per page |

Name filters match exact names without case sensitivity. Keyword search matches
part of the public text without case sensitivity. Date filters use the event
date and include the whole first and last day in UTC. Invalid dates, reversed
ranges, repeated parameters, and unknown parameters return `400`.

The default page size is 20 and the maximum is 100. Results are ordered newest
first, with the report ID used to keep the order stable when times are equal.
The response is `{ "reports": [...], "page": 1, "limit": 20, "total": 42 }`;
`total` counts all matching reports before pagination. Category, location, and
owner name are included. Creation returns `201`; deletion returns `204` with no
body. Other successful requests return `200`.

### SQL used for search

The listing controller uses ordinary SQL: `JOIN` connects reports to their
category, location, and owner; `WHERE` applies filters; `ILIKE` searches text;
`ORDER BY`, `LIMIT`, and `OFFSET` handle ordering and pages. Prisma sends input
as separate SQL parameters, so entered text is never executed as SQL.

For example, a simplified query for the first page of lost wallets is:

```sql
SELECT r."id", r."title", c."name" AS category, l."name" AS location
FROM "ItemReport" r
JOIN "Category" c ON r."categoryId" = c."id"
JOIN "Location" l ON r."locationId" = l."id"
WHERE r."type" = 'LOST'
  AND r."status" = 'ACTIVE'
  AND c."name" = 'Wallet'
  AND r."description" ILIKE '%black%'
ORDER BY r."createdAt" DESC, r."id" DESC
LIMIT 20 OFFSET 0;
```

The existing database migrations already create simple indexes on type/status,
category/type, location/type, event date, and owner/creation time. These help
filter reports by those fields. Keyword matching checks text directly, which
is sufficient for this MVP; no special search engine or advanced SQL is used.

### Checking the reporting features

The tests use Node's built-in test runner and a separate PostgreSQL database.
They check both report types, ownership, closing, private details, filters,
pagination, invalid inputs, and SQL-looking search text.

Create a local test database, apply migrations to it, and run:

```bash
createdb findback_test
DATABASE_URL="postgresql://localhost:5432/findback_test" DIRECT_URL="postgresql://localhost:5432/findback_test" npm run db:migrate
TEST_DATABASE_URL="postgresql://localhost:5432/findback_test" npm test
```

Use your local PostgreSQL username/password in those URLs if required. The tests
require `TEST_DATABASE_URL` and refuse a database that already contains reports.

Errors have a simple format:

```json
{ "error": "Please provide a valid email address." }
```

Invalid input returns `400`, missing records return `404`, and duplicates or
linked-record conflicts return `409`. Unexpected failures return `500` without
exposing database details.

## Code structure

```text
src/
  app.js          Express app and routes
  server.js       Database connection and startup
  config/         Environment settings and Prisma client
  routes/         API endpoints and their middleware
  controllers/    Registration, login, reports, and lookups
  middleware/     Authentication, validation, and error handling
scripts/
  createAdmin.js  Create an admin from local environment settings
```

Express 5 handles rejected async handlers, so controllers can throw errors
and the central error handler sends the response.

For an expected failure, the code creates an ordinary JavaScript error and sets
the HTTP status to send:

```js
const error = new Error("Admin access is required.");
error.statusCode = 403;
throw error;
```

The central error handler sends the status and message as a JSON response.
