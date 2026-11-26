# HUMANAID – Project Requirements & Deployment Guide

## 📐 Architecture Overview

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  Frontend (React + Vite)     │──────▶│  Backend (.NET 10 Web API)   │
│  Hosted on: Vercel           │  API  │  Hosted on: Railway          │
│  humanitarian-crisis-frontend│  CORS │  HumanitarianCrisis.API      │
└──────────────────────────────┘       └──────────────────────────────┘
                                                    │
                                                    ▼
                                        ┌──────────────────────────────┐
                                        │  PostgreSQL (Railway plugin) │
                                        └──────────────────────────────┘
```

---

## 🖥️ Local Development Requirements

### Backend Requirements

| Tool | Version | Download |
|------|---------|----------|
| .NET SDK | **10.0** (Preview) | https://dotnet.microsoft.com/download/dotnet/10.0 |
| (Optional) PostgreSQL | 15+ | https://www.postgresql.org/download/ |
| (Optional) Docker | Latest | https://www.docker.com/get-started |

> **Quick check:** Run `dotnet --version` → must show `10.x.x`

### Frontend Requirements

| Tool | Version | Download |
|------|---------|----------|
| Node.js | **20 LTS** or **22 LTS** | https://nodejs.org/ |
| npm | 10+ (bundled with Node) | — |

> **Quick check:** Run `node --version` → must show `v20.x.x` or `v22.x.x`

---

## 🚀 Local Development Setup

### 1. Clone / Open the Project

```bash
cd Humanitarian-Crisis-Management-System-Fixed/Humanitarian-Crisis-Management-System/HumanitarianCrisis
```

### 2. Start the Backend API

```bash
cd HumanitarianCrisis.API

# Restore NuGet packages
dotnet restore

# Run (uses SQLite by default — no database install needed)
dotnet run
```

The API will start at `http://localhost:5122`  
Health check: `http://localhost:5122/api/health`

**Default dev admin credentials are printed in the console on first run.**

### 3. Start the Frontend

```bash
cd humanitarian-crisis-frontend

# Install dependencies
npm install

# Copy env file and start dev server
# (Already created as .env.local — just run:)
npm run dev
```

The frontend will start at `http://localhost:5173`

---

## 🌐 Production Deployment

### Part 1 — Deploy Backend to Railway

#### Step 1: Create a Railway Account
Go to [railway.app](https://railway.app) and sign up (free tier available).

#### Step 2: Create a New Project
1. Click **New Project**
2. Choose **Deploy from GitHub repo**
3. Connect your GitHub account and select your repository
4. Set the **Root Directory** to: `Humanitarian-Crisis-Management-System/HumanitarianCrisis/HumanitarianCrisis.API`

#### Step 3: Add PostgreSQL Database
1. In your Railway project, click **+ New**
2. Choose **Database → Add PostgreSQL**
3. Railway auto-creates `DATABASE_URL` and `${{Postgres.DATABASE_URL}}`

#### Step 4: Set Environment Variables on Railway

Go to your API service → **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `Jwt__Key` | A random 48+ char string | Generate: `openssl rand -base64 48` |
| `Jwt__Issuer` | `HUMANAID` | Must match frontend |
| `Jwt__Audience` | `HUMANAID-Users` | Must match frontend |
| `Database__Provider` | `Postgres` | Tells API to use PostgreSQL |
| `ConnectionStrings__Default` | `${{Postgres.DATABASE_URL}}` | Auto-linked from Railway PostgreSQL |
| `BootstrapAdmin__Email` | `admin@yourdomain.com` | First admin user |
| `BootstrapAdmin__Password` | A strong 12+ char password | Keep this secret! |
| `FrontendUrl` | `https://your-app.vercel.app` | Your Vercel URL (set after Step Part 2) |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Enables production settings |

> **Note:** Railway uses `__` (double underscore) as the separator for nested config keys.

#### Step 5: Deploy
Railway will automatically build using the `Dockerfile` and deploy.  
Your API URL will be: `https://your-service-name.up.railway.app`

**Verify:** Visit `https://your-service-name.up.railway.app/api/health` — should return `{"status":"healthy",...}`

---

### Part 2 — Deploy Frontend to Vercel

#### Step 1: Create a Vercel Account
Go to [vercel.com](https://vercel.com) and sign up (free tier available).

#### Step 2: Import Project
1. Click **Add New → Project**
2. Import your GitHub repository
3. Set **Root Directory** to: `Humanitarian-Crisis-Management-System/HumanitarianCrisis/humanitarian-crisis-frontend`
4. Framework preset: **Vite** (auto-detected)

#### Step 3: Set Environment Variables on Vercel

Go to your project → **Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-service-name.up.railway.app` |

> **Important:** Use your actual Railway API URL here (no trailing slash).

#### Step 4: Deploy
Click **Deploy**. Vercel will run `npm run build` and serve the `dist/` folder.

Your frontend URL will be: `https://your-app.vercel.app`

#### Step 5: Update Backend CORS
Go back to Railway and update the `FrontendUrl` variable:
```
FrontendUrl = https://your-app.vercel.app
```
Then redeploy the backend service.

---

## 🔑 Required Environment Variables Summary

### Backend (Railway)

```env
# Database (linked automatically from Railway PostgreSQL plugin)
Database__Provider=Postgres
ConnectionStrings__Default=${{Postgres.DATABASE_URL}}

# JWT Authentication (REQUIRED — must be at least 32 bytes)
Jwt__Key=<generate with: openssl rand -base64 48>
Jwt__Issuer=HUMANAID
Jwt__Audience=HUMANAID-Users
Jwt__ExpiryMinutes=60

# First admin account
BootstrapAdmin__Email=admin@yourdomain.com
BootstrapAdmin__Password=YourStrongPassword123!

# CORS — allow your Vercel frontend
FrontendUrl=https://your-app.vercel.app

# Optional: extra CORS origins (e.g. preview deployments)
CORS_EXTRA_ORIGIN=https://your-app-preview.vercel.app

# ASP.NET
ASPNETCORE_ENVIRONMENT=Production

# Optional: Email notifications (via SMTP)
Notifications__Email__SmtpHost=smtp.gmail.com
Notifications__Email__Port=587
Notifications__Email__EnableSsl=true
Notifications__Email__From=noreply@yourdomain.com
Notifications__Email__Username=your@gmail.com
Notifications__Email__Password=your-app-password

# Optional: SMS notifications (via Twilio)
Notifications__Sms__TwilioAccountSid=ACxxxxx
Notifications__Sms__TwilioAuthToken=your-auth-token
Notifications__Sms__TwilioFromNumber=+1234567890
```

### Frontend (Vercel)

```env
# Backend API URL (no trailing slash)
VITE_API_URL=https://your-api-name.up.railway.app
```

---

## 🗄️ Database Notes

### SQLite (Local Dev — No Setup Needed)
Default for local development. The `humanaid.db` file is auto-created on first run.

### PostgreSQL (Production — Railway)
- Automatically provisioned by Railway's PostgreSQL plugin
- Schema is auto-created by EF Core on startup (`EnsureCreated()`)
- No manual migrations needed for initial deploy
- **Railway provides the connection string via `${{Postgres.DATABASE_URL}}`**

---

## 📦 Project Dependencies

### Backend NuGet Packages (auto-restored by `dotnet restore`)

| Package | Purpose |
|---------|---------|
| `Microsoft.AspNetCore.Authentication.JwtBearer` | JWT auth |
| `Microsoft.EntityFrameworkCore.Sqlite` | SQLite (dev) |
| `Microsoft.EntityFrameworkCore.SqlServer` | SQL Server (optional) |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | PostgreSQL (production) |

### Frontend npm Packages (auto-installed by `npm install`)

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `vite` | Build tool |
| `@vitejs/plugin-react` | React support in Vite |
| `oxlint` | Fast linter |

---

## 🩺 Troubleshooting

### Backend won't start on Railway
- Check that `Jwt__Key` is set and is at least 32 characters
- Check that `ConnectionStrings__Default` is linked to the PostgreSQL plugin
- Check the Railway logs for the actual error message

### Frontend shows "Cannot reach the API"
- Verify `VITE_API_URL` in Vercel matches your Railway URL exactly
- Confirm the backend is running: visit `https://your-api.up.railway.app/api/health`
- Verify CORS: `FrontendUrl` on Railway must match your Vercel URL exactly

### Login fails after Railway redeploy
- If `Jwt__Key` is not set as a fixed env var, a random key is generated on each start
- **Always set `Jwt__Key` to a fixed secret on Railway** to avoid token invalidation on restart

### Database schema errors
- EF Core creates the schema automatically on startup
- If you change models, delete the `humanaid.db` (local) or use Railway's DB console to drop/recreate

---

## 📂 Folder Structure

```
HumanitarianCrisis/
├── humanitarian-crisis-frontend/     ← React + Vite (deploy to Vercel)
│   ├── src/
│   ├── public/
│   ├── vercel.json                   ← SPA routing + headers (created)
│   ├── vite.config.js                ← Fixed for production
│   ├── .env.local                    ← Local dev env (do not commit)
│   └── .env.example
│
└── HumanitarianCrisis.API/           ← .NET 10 Web API (deploy to Railway)
    ├── Controllers/
    ├── Data/
    ├── Models/
    ├── Services/
    ├── Dockerfile                    ← Railway build (created)
    ├── railway.toml                  ← Railway config (created)
    ├── appsettings.json              ← Defaults to SQLite for dev
    ├── appsettings.Production.json   ← Switches to Postgres for prod
    └── Program.cs                    ← Fixed: PORT binding for Railway
```
