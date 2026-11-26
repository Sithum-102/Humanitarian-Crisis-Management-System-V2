# HUMANAID — ASP.NET Core Backend (Member 2)

.NET 10 Web API with in-memory demo data. **Not production-ready.**

## Start

```powershell
dotnet restore
dotnet build
dotnet run
```

Default URL: `http://localhost:5122`.

## API endpoints

- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/analytics/incidents`
- CRUD (`GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`) for:
  - `/api/incidents`
  - `/api/emergencyrequests`
  - `/api/resources`
  - `/api/shelters`
  - `/api/volunteers`
  - `/api/operations`
  - `/api/organizations`
  - `/api/users`

## Quick test

```powershell
Invoke-RestMethod http://localhost:5122/api/health
Invoke-RestMethod http://localhost:5122/api/incidents
Invoke-RestMethod http://localhost:5122/api/dashboard/summary
```

## Notes

- Records are stored with EF Core using the configured provider (SQLite by default; PostgreSQL and SQL Server are supported). The development database seeds sample records when it is empty.
- JWT authentication and role checks protect the registries. Public SOS submissions use a separate anonymous, rate-limited endpoint.
- Audit entries are stored in `AuditLogs`. New records, updates, deletes, public request submissions, and request status changes are recorded with actor, role, and UTC time.
- Audit history is available to Admin and Coordinator accounts at `GET /api/auditlogs?entityType=EmergencyRequest&entityId={id}`.
- Human review of a request-linked AI recommendation can be recorded at `POST /api/auditlogs/ai-decision` with `RequestId`, `Recommendation`, `Confidence` (0–1), `Decision` (`Accepted`, `Modified`, `Rejected`, or `Deferred`), and optional `AppliedValue`/`Notes`.
- The current frontend Intelligence Center remains transparent rule-based decision support, not machine learning. The AI decision audit endpoint is ready for the later recommendation approval UI.
- Email/SMS/push delivery, live push updates, and full AI inference are not implemented yet.
- CRUD, persistence, authorization and audit support are for a coursework prototype and still need full security and workflow review before deployment.
- CORS permits React Vite at localhost:5173.
- Member 3 should coordinate the eventual database entities/schema and migrations.
- The React UI uses the API for registry data. The Emergency Requests table provides a History action for Admin and Coordinator users.
- Avoid committing `bin`, `obj`, `.vs`, `*.user`, or credentials.
