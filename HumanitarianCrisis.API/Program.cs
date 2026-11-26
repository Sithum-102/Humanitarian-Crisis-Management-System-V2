using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Railway.app sets PORT env var; bind to it so the container serves traffic.
// ---------------------------------------------------------------------------
var railwayPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(railwayPort) && int.TryParse(railwayPort, out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// ---------------------------------------------------------------------------
// JWT signing key. Production must supply Jwt:Key (user-secrets / env var).
// In Development a random per-run key is generated so `dotnet run` just works.
// ---------------------------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:Key"] ?? string.Empty;
var generatedDevKey = false;

if (string.IsNullOrWhiteSpace(jwtKey))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Jwt:Key is not configured. Set it with user-secrets or the Jwt__Key environment variable.");

    jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    builder.Configuration["Jwt:Key"] = jwtKey;
    generatedDevKey = true;
}

if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes.");

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
builder.Services
    .AddControllers(options =>
    {
        // Validation is declared explicitly on the models. Without this, every non-nullable
        // string (e.g. Description, Phone) became implicitly required and blank optional
        // fields were rejected with 400.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Return { message, errors } so the frontend can show a readable first error.
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(entry => entry.Value is { Errors.Count: > 0 })
                .ToDictionary(
                    entry => entry.Key,
                    entry => entry.Value!.Errors
                        .Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage) ? "Invalid value." : error.ErrorMessage)
                        .ToArray());

            var message = errors.Values.SelectMany(messages => messages).FirstOrDefault() ?? "The request is invalid.";

            return new BadRequestObjectResult(new { message, errors });
        };
    });

builder.Services.AddProblemDetails();

// Database: Sqlite (default, no install needed), Postgres or SqlServer.
var databaseProvider = builder.Configuration["Database:Provider"] ?? "Sqlite";
var connectionString = builder.Configuration.GetConnectionString("Default");

if (string.IsNullOrWhiteSpace(connectionString))
{
    if (!databaseProvider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException($"ConnectionStrings:Default is required for the {databaseProvider} provider.");

    connectionString = "Data Source=humanaid.db";
}

builder.Services.AddDbContext<CrisisDbContext>(options =>
{
    switch (databaseProvider.ToLowerInvariant())
    {
        case "sqlite":
            options.UseSqlite(connectionString);
            break;
        case "postgres":
        case "postgresql":
            options.UseNpgsql(connectionString);
            break;
        case "sqlserver":
            options.UseSqlServer(connectionString);
            break;
        default:
            throw new InvalidOperationException($"Unsupported Database:Provider '{databaseProvider}'. Use Sqlite, Postgres or SqlServer.");
    }
});

builder.Services.AddScoped<CrisisStore>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddHttpClient("twilio", client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<NotificationDeliveryService>();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],

            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),

            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };

        options.Events = new JwtBearerEvents
        {
            // Re-check the account on every request so a disabled/deleted account, or a changed
            // role, takes effect immediately instead of when the token expires.
            OnTokenValidated = context =>
            {
                var store = context.HttpContext.RequestServices.GetRequiredService<CrisisStore>();
                var subject = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (!int.TryParse(subject, out var accountId))
                {
                    context.Fail("Invalid token subject.");
                    return Task.CompletedTask;
                }

                var account = store.Find<AuthAccount>(accountId, a => a.Id);

                if (account is null || account.Status != "Active")
                {
                    context.Fail("Account is no longer active.");
                    return Task.CompletedTask;
                }

                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    foreach (var claim in identity.FindAll(ClaimTypes.Role).ToList())
                        identity.RemoveClaim(claim);

                    identity.AddClaim(new Claim(ClaimTypes.Role, account.Role));
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
if (corsOrigins is null || corsOrigins.Length == 0)
    corsOrigins = new[] { "http://localhost:5173", "http://127.0.0.1:5173" };

// Allow additional origins supplied at runtime (e.g. Vercel preview/production URLs).
var extraOrigin = Environment.GetEnvironmentVariable("CORS_EXTRA_ORIGIN");
if (!string.IsNullOrWhiteSpace(extraOrigin))
    corsOrigins = corsOrigins.Append(extraOrigin).ToArray();

var frontendUrl = builder.Configuration["FrontendUrl"];
if (!string.IsNullOrWhiteSpace(frontendUrl) && !corsOrigins.Contains(frontendUrl))
    corsOrigins = corsOrigins.Append(frontendUrl).ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Request throttling for login/register and public SOS submissions (per client IP).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("sos", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));

    options.AddPolicy("volunteer-donations", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));

    options.AddPolicy("notifications", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// ---------------------------------------------------------------------------
// Database creation, demo data and the first administrator.
// ---------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CrisisDbContext>();
    db.Database.EnsureCreated();
    AuditLogSchema.EnsureCreated(db);
    await NotificationSchema.EnsureAsync(scope.ServiceProvider.GetRequiredService<CrisisDbContext>());
    await PasswordResetSchema.EnsureAsync(db);
    await RequestWorkflowSchema.EnsureAsync(scope.ServiceProvider.GetRequiredService<CrisisDbContext>());
    await VolunteerPortalSchema.EnsureAsync(db);
    app.Logger.LogInformation("Database ready ({Provider}).", databaseProvider);

    var store = scope.ServiceProvider.GetRequiredService<CrisisStore>();

    if (app.Environment.IsDevelopment())
    {
        if (generatedDevKey)
            app.Logger.LogWarning("Jwt:Key not configured - using a random development key. Sign-ins end when the API restarts.");

        if (app.Configuration.GetValue("Seed:DemoData", true))
            store.SeedDemoData();
    }

    var adminEmail = app.Configuration["BootstrapAdmin:Email"];
    var adminPassword = app.Configuration["BootstrapAdmin:Password"];
    var generatedPassword = false;

    if ((string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword)) && app.Environment.IsDevelopment())
    {
        adminEmail = "admin@humanaid.test";
        adminPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12)).Replace('+', 'A').Replace('/', 'B');
        generatedPassword = true;
    }

    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        if (adminPassword.Length < 12)
        {
            app.Logger.LogWarning("BootstrapAdmin:Password must be at least 12 characters - admin account not created.");
        }
        else
        {
            var email = adminEmail.Trim().ToLowerInvariant();
            var hasher = new PasswordHasher<AuthAccount>();
            var existing = store.All<AuthAccount>().FirstOrDefault(a => a.Email == email);

            if (existing is null)
            {
                var admin = new AuthAccount { Name = "Administrator", Email = email, Role = "Admin" };
                admin.PasswordHash = hasher.HashPassword(admin, adminPassword);
                store.Add(admin, (a, id) => a.Id = id);
            }
            else if (generatedPassword)
            {
                // The development admin is stored in the database now, so give it a fresh one-time password each run.
                existing.PasswordHash = hasher.HashPassword(existing, adminPassword);
                existing.Role = "Admin";
                existing.Status = "Active";
                store.Update(existing.Id, existing, a => a.Id, (a, id) => a.Id = id);
            }

            if (generatedPassword)
                app.Logger.LogWarning(
                    "DEVELOPMENT ONLY - admin login: {Email} / {Password}  (new password on every start; set BootstrapAdmin secrets to choose your own)",
                    email, adminPassword);
        }
    }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
app.UseExceptionHandler();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () =>
    Results.Ok(new
    {
        status = "healthy",
        service = "HUMANAID API",
        timestamp = DateTime.UtcNow
    }));

app.Run();
