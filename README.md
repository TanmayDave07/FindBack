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
| DELETE | `/api/reports/:id` | Report owner or admin |
| GET | `/api/admin/users` | Admin only |

Students can change their own report details. Only admins can set report status.
A student requesting an admin route receives `403 Forbidden`. Requests without
a valid token receive `401 Unauthorized`.

## Reports

Get category and location IDs from `/api/categories` and `/api/locations`.
Create a report with `POST /api/reports`:

```json
{
  "type": "LOST",
  "title": "Lost blue wallet",
  "description": "A blue wallet near the library.",
  "categoryId": "REPLACE_WITH_CATEGORY_UUID",
  "locationId": "REPLACE_WITH_LOCATION_UUID",
  "eventDate": "2026-11-16T10:00:00Z",
  "color": "Blue",
  "locationDetails": "First floor"
}
```

Required fields: `type` (`LOST` or `FOUND`), `title`, `description`, `categoryId`,
`locationId`, and `eventDate` (ISO date and time). Optional fields: `color`,
`imageUrl` (HTTP/HTTPS URL), `categoryDetails`, and `locationDetails`.
Send `null` to clear optional fields. The server sets `userId` from the account.

`PATCH` accepts only fields being changed. Admins may also set `status` to
`ACTIVE`, `MATCHED`, `RESOLVED`, or `CLOSED`. A report linked to a claim cannot
be deleted and returns `409 Conflict`.

List reports with optional filters:

```text
GET /api/reports?page=1&limit=20&type=LOST&status=ACTIVE
```

`categoryId` and `locationId` filters are also supported. The default page size
is 20 and the maximum is 100. The response is `{ "reports": [...], "page": 1,
"limit": 20, "total": 42 }`. Creation returns `201`; deletion returns `204`
with no body. Other successful requests return `200`.

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
