# E‑Ticketing Monorepo

Monorepo for an online e‑ticketing platform built with Angular (frontend) and Spring Boot + MongoDB (backend).

## Prerequisites

- Node.js 20+
- Java 21 (Temurin)
- Docker Desktop (optional for local Mongo)

## Run locally (Windows PowerShell)

Backend (default port 8080):

```powershell
cd apps/backend
./mvnw spring-boot:run
```

If 8080 is busy, set a different port at runtime:

```powershell
cd apps/backend
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=8081"
```

Frontend (Angular dev server):

```powershell
cd apps/frontend
npm install
npm run start
```

MongoDB (Docker):

```powershell
docker compose -f infra/docker-compose.yml up -d mongo
```

Configuration: see `apps/backend/src/main/resources/application.properties`.

### Email configuration

The backend can send emails through SMTP, Resend, or automatically fall back from SMTP to Resend.

| Variable                                                      | Default                    | Notes                                                        |
| ------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------ |
| `MAIL_PROVIDER`                                               | `auto`                     | `smtp`, `resend`, or `auto` (tries SMTP then Resend)         |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | `localhost:1025`           | Standard Spring mail settings for SMTP                       |
| `MAIL_SMTP_AUTH` / `MAIL_SMTP_STARTTLS`                       | `false`                    | Enable if your SMTP requires auth/TLS                        |
| `MAIL_FROM`                                                   | `noreply@eticketing.local` | Sender address shown to recipients                           |
| `RESEND_API_KEY`                                              | _(empty)_                  | Required when `MAIL_PROVIDER` is `resend` or `auto` fallback |
| `RESEND_BASE_URL`                                             | `https://api.resend.com`   | Override only for testing/self-hosting                       |

For local testing without a real SMTP server you can use [MailHog](https://github.com/mailhog/MailHog) or smtp4dev, or set `MAIL_PROVIDER=resend` with a valid API key.

## API overview

- Auth: `/api/auth/register`, `/api/auth/login`
- Users: `/api/users/me`, `/api/users` (ADMIN paginated list), deletions
- Trips: `/api/trips` CRUD (ADMIN/MANAGER)
- Search: `/api/search/trips` (public)
- Seats on a trip: `/api/trips/{id}/seats` (GET map, PUT init/update), `/api/trips/{id}/seats:reserve` (POST)

Pagination envelope (0-based):

```json
{
  "objects": [
    /* items */
  ],
  "count": 42,
  "isLast": false
}
```

### Auth

Register (email OR phone, role required):

```json
{
  "firstName": "Amine",
  "lastName": "Dali",
  "email": "amine@example.com",
  "password": "YourPass123!",
  "role": "CUSTOMER"
}
```

Or with phone:

```json
{
  "firstName": "Amine",
  "lastName": "Dali",
  "password": "YourPass123!",
  "phone": { "countryCode": "216", "number": "12345678" },
  "role": "CUSTOMER"
}
```

Both Register and Login return:

```json
{
  "token": "<JWT>",
  "user": {
    "id": "...",
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "role": "...",
    "phone": { "countryCode": "216", "number": "12345678" }
  }
}
```

### Trips

Create (ADMIN/MANAGER):

```json
{
  "source": {
    "city": "Tunis",
    "location": { "type": "POINT", "coordinates": [10.1815, 36.8065] }
  },
  "destination": {
    "city": "Sfax",
    "location": { "type": "POINT", "coordinates": [10.7603, 34.739] }
  },
  "departureDate": "2025-10-10",
  "price": 19.9,
  "availableSeats": 30
}
```

Search (public): `GET /api/search/trips?source=Tunis&destination=Sfax&date=2025-10-10&page=0&limit=10`

### Seats (no client version)

Initialize/Update seat map (ADMIN/MANAGER):

```json
{
  "seats": [
    { "row": 1, "col": 1, "state": "AVAILABLE" },
    { "row": 1, "col": 2, "state": "BLOCKED" }
  ]
}
```

Get seat map: `GET /api/trips/{id}/seats` → `{ "tripId": "...", "seats": [{"row":1,"col":1,"state":"AVAILABLE"}] }`

Reserve seats: `POST /api/trips/{id}/seats:reserve`

```json
{
  "seats": [
    { "row": 3, "col": 1 },
    { "row": 3, "col": 2 }
  ]
}
```

Errors use a standard JSON error with proper HTTP codes (400, 401, 403, 404, 409, 500).

## Import Postman collection

Import `postman_collection.json` from the repo root. Set variables:

- baseUrl: `http://localhost:8080` (or `8081` if you changed the port)
- token: paste the JWT after login/register
- tripId: set after creating a trip

## Repo structure

- apps/frontend: Angular app (SSR-ready)
- apps/backend: Spring Boot service
- contracts: OpenAPI spec and generators
- infra: Dockerfiles, compose, k8s
- docs: architecture, roadmap
- tests: e2e/integration

See `docs/architecture.md` and `docs/roadmap.md` for more details.
