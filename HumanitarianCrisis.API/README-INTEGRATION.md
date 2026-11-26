# HUMANAID – ASP.NET Core API (integration notes)

## Database
Data is stored in a real database through EF Core. The tables are created automatically on first start (`EnsureCreated`).

| Provider | Setup |
| --- | --- |
| **SQLite** (default) | Nothing to install. A `humanaid.db` file is created next to the project. |
| **PostgreSQL** | `docker compose up -d` (file included) or your own server, then set `Database__Provider=Postgres` and `ConnectionStrings__Default="Host=localhost;Port=5432;Database=humanaid;Username=humanaid;Password=humanaid_dev_password"` |
| **SQL Server** | `Database__Provider=SqlServer` and `ConnectionStrings__Default="Server=localhost;Database=HumanAid;Trusted_Connection=True;TrustServerCertificate=True"` |

Put real connection strings in user-secrets or environment variables, never in `appsettings.json`:

```powershell
dotnet user-secrets set "Database:Provider" "Postgres"
dotnet user-secrets set "ConnectionStrings:Default" "Host=...;Database=humanaid;Username=...;Password=..."
```

Delete `humanaid.db` (SQLite) to start from a clean database. `EnsureCreated` does not upgrade an existing schema: when the models change, switch to EF Core migrations (`dotnet ef migrations add Init`).

## Run (development)
Requires the .NET 10 SDK.

```powershell
dotnet run
```

In Development:

* A random JWT signing key is generated for the run (sign-ins end when the API restarts).
* Demo data (incidents, requests, shelters, volunteers, ...) is added once, only if the database has no incidents. Turn it off with `Seed:DemoData=false`.
* If no admin is configured, `admin@humanaid.test` gets a **new random password printed in the console on every start**.

To choose your own admin and key:

```powershell
dotnet user-secrets set "Jwt:Key" "A_RANDOM_SECRET_OF_AT_LEAST_32_BYTES"
dotnet user-secrets set "BootstrapAdmin:Email" "you@example.test"
dotnet user-secrets set "BootstrapAdmin:Password" "A_STRONG_PASSWORD_12_OR_MORE_CHARS"
```

Outside Development, `Jwt:Key` and (for non-SQLite) `ConnectionStrings:Default` are mandatory. No demo data is added; a first admin is created only from `BootstrapAdmin:*` if you set it.

## Endpoints
* `GET /api/health`
* `POST /api/auth/register` (`name`, `email`, `password`; always creates a Viewer), `POST /api/auth/login`, `GET /api/auth/me`
* CRUD: `/api/incidents`, `/api/emergencyrequests`, `/api/operations`, `/api/resources`, `/api/shelters`, `/api/volunteers`, `/api/organizations`
* `/api/users` (Admin only, never returns password hashes)
* `GET /api/dashboard/summary`, `GET /api/analytics/incidents` (any signed-in user)

Reads: any signed-in user. Create/update/delete: Admin or Coordinator.

## Validation errors
Invalid input returns `400` with `{ "message": "first error", "errors": { "Field": ["..."] } }`.
Allowed values (severity, status, category, ...) are declared on the model classes in `Models/`; the frontend's dropdowns mirror them.

## Security behaviour
* The account is re-checked on every request: disabling/deleting a user or changing their role takes effect immediately, not when the token expires.
* Login/register are rate limited (20 requests/minute per IP).
* CORS origins come from `Cors:Origins` in `appsettings.json`.
* Basic security headers are added to every response.

## Limitations
Still a development prototype: no EF migrations yet, no PostGIS/map data, refresh tokens, audit log, notifications or load testing. Do not enter real personal or emergency data.
