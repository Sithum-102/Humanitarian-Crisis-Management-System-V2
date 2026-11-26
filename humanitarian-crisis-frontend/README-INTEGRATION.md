# HUMANAID – API-connected React frontend

## Setup
1. Node.js 22+, then `npm install`.
2. `.env.example` -> `.env` if you need a different API URL (default `http://localhost:5122`). Data now comes from the backend database, so it survives restarts.
3. Start the API first (`dotnet run` in the backend folder). The console prints the development admin login.
4. `npm run dev` and open the Vite URL.

## What the UI does
* Sign in / register (Viewer). Registration asks for a confirm password in the browser.
* Roles: Admin and Coordinator can create, edit and delete records; Viewer and Volunteer are read-only; user management is Admin-only.
* Every registry table supports search, status filter, column sorting and CSV export.
* Dashboard, Analytics and Intelligence pages are computed from live API data. Intelligence is **rule-based**, not machine learning.
* Data auto-refreshes every 30 seconds while the tab is visible (toggle in Settings). Expired sessions return to the login screen.
* The radar map is **illustrative**, not a GIS map.

## API contract
`src/services/api/client.js` maps the few frontend names that differ from the API:
incidents `people`/`peopleAffected`, requests `requester`/`requesterName` + `need`/`description`, operations `name`/`title` + `area`/`location`, shelters `occupied`/`occupancy`, volunteers `availability`/`status`.
Status dropdown values mirror the backend model validation (`backend/Models`).

Authentication keeps the JWT in `sessionStorage` (development build); production should use secure cookies / refresh tokens.
