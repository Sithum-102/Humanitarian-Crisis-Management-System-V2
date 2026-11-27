using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.DTOs;
using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly PasswordResetService _passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService)
    {
        _authService = authService;
        _passwordResetService = passwordResetService;
    }

    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        [FromServices] NotificationDeliveryService delivery,
        [FromServices] CrisisDbContext db,
        [FromServices] ILogger<AuthController> logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = _authService.Register(request);

            // Send Welcome Email
            try
            {
                var emailSubject = "Welcome to HUMANAID Crisis Response";
                var emailBody = $"Hello {request.Name.Trim()},\n\nWelcome to HUMANAID! Your account has been registered successfully.\n\nYou can now sign in to access emergency response portals, request assistance, or volunteer.\n\nHUMANAID Crisis Operations Team";

                var emailRecord = new NotificationRecord
                {
                    Recipient = request.Email.Trim().ToLowerInvariant(),
                    RecipientName = request.Name.Trim(),
                    Channel = "Email",
                    Subject = emailSubject,
                    Message = emailBody,
                    Status = "Queued",
                    Attempts = 0,
                    CreatedByAccountId = result.UserId,
                    CreatedByName = "HUMANAID System",
                    CreatedAt = DateTime.UtcNow
                };
                db.Notifications.Add(emailRecord);
                await db.SaveChangesAsync(cancellationToken);

                var emailResult = await delivery.SendAsync("Email", request.Email.Trim().ToLowerInvariant(), emailSubject, emailBody, cancellationToken);
                emailRecord.Attempts = 1;
                emailRecord.Status = emailResult.Status;
                emailRecord.LastError = emailResult.Error;
                if (emailResult.Status == "Sent") emailRecord.SentAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send registration welcome email.");
            }

            // Send Welcome SMS (if phone number provided)
            if (!string.IsNullOrWhiteSpace(request.Phone))
            {
                try
                {
                    var cleanPhone = request.Phone.Trim();
                    var smsSubject = "HUMANAID Registration";
                    var smsBody = $"HUMANAID: Welcome {request.Name.Trim()}! Your account has been registered successfully. Contact emergency portals whenever aid is needed.";

                    var smsRecord = new NotificationRecord
                    {
                        Recipient = cleanPhone,
                        RecipientName = request.Name.Trim(),
                        Channel = "SMS",
                        Subject = smsSubject,
                        Message = smsBody,
                        Status = "Queued",
                        Attempts = 0,
                        CreatedByAccountId = result.UserId,
                        CreatedByName = "HUMANAID System",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Notifications.Add(smsRecord);
                    await db.SaveChangesAsync(cancellationToken);

                    var smsResult = await delivery.SendAsync("SMS", cleanPhone, smsSubject, smsBody, cancellationToken);
                    smsRecord.Attempts = 1;
                    smsRecord.Status = smsResult.Status;
                    smsRecord.LastError = smsResult.Error;
                    if (smsResult.Status == "Sent") smsRecord.SentAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to send registration welcome SMS.");
                }
            }

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public IActionResult Login(LoginRequest request)
    {
        var result = _authService.Login(request);

        if (result == null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        return Ok(result);
    }

    [EnableRateLimiting("auth")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await _passwordResetService.RequestResetAsync(request.Email, cancellationToken);
        return Ok(new { message = "If an active account exists for that email, a password reset link has been sent." });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var reset = await _passwordResetService.ResetPasswordAsync(request.Token, request.NewPassword, cancellationToken);
        if (!reset)
            return BadRequest(new { message = "This reset link is invalid or expired. Request a new one." });

        return Ok(new { message = "Password updated. You can now sign in." });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me([FromServices] HumanitarianCrisis.API.Services.CrisisStore store)
    {
        var subject = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        HumanitarianCrisis.API.Models.AuthAccount? account = null;
        if (int.TryParse(subject, out var id))
        {
            account = store.Find<HumanitarianCrisis.API.Models.AuthAccount>(id, a => a.Id);
        }

        var name = !string.IsNullOrWhiteSpace(account?.Name) && account.Name != "null"
            ? account.Name
            : (!string.IsNullOrWhiteSpace(User.Identity?.Name) && User.Identity.Name != "null"
                ? User.Identity.Name
                : null);

        var email = !string.IsNullOrWhiteSpace(account?.Email) && account.Email != "null"
            ? account.Email
            : (!string.IsNullOrWhiteSpace(User.FindFirst(ClaimTypes.Email)?.Value) && User.FindFirst(ClaimTypes.Email)?.Value != "null"
                ? User.FindFirst(ClaimTypes.Email)?.Value
                : null);

        return Ok(new
        {
            UserId = subject,
            Name = name ?? email ?? "Authorized Officer",
            Email = email ?? "officer@humanaid.org",
            Phone = account?.Phone,
            Role = account?.Role ?? User.FindFirst(ClaimTypes.Role)?.Value ?? "Viewer"
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin")]
    public IActionResult AdminOnly()
    {
        return Ok(new
        {
            message = "Admin access granted."
        });
    }
}
