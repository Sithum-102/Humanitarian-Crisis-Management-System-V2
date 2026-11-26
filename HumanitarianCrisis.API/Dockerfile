# ── Build stage ────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj first for layer-cache efficiency
COPY HumanitarianCrisis.API.csproj ./
RUN dotnet restore

# Copy everything else and publish
COPY . .
RUN dotnet publish HumanitarianCrisis.API.csproj -c Release -o /app/publish --no-restore

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install SQLite libs (fallback when no DATABASE_URL is set)
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Railway injects PORT at runtime; Program.cs binds to it automatically.
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "HumanitarianCrisis.API.dll"]
