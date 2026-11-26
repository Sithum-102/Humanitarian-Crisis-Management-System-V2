using HumanitarianCrisis.API.DTOs;
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
    public IActionResult Register(RegisterRequest request)
    {
        try
        {
            var result = _authService.Register(request);
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
    public IActionResult Me()
    {
        return Ok(new
        {
            UserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
            Name = User.Identity?.Name,
            Email = User.FindFirst(ClaimTypes.Email)?.Value,
            Role = User.FindFirst(ClaimTypes.Role)?.Value
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
