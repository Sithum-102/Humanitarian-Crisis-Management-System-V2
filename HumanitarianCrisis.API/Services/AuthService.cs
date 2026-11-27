using HumanitarianCrisis.API.DTOs;
using HumanitarianCrisis.API.Models;
using Microsoft.AspNetCore.Identity;

namespace HumanitarianCrisis.API.Services;

public sealed class AuthService
{
    private readonly CrisisStore _store;
    private readonly TokenService _tokenService;
    private readonly PasswordHasher<AuthAccount> _passwordHasher = new();

    public AuthService(CrisisStore store, TokenService tokenService)
    {
        _store = store;
        _tokenService = tokenService;
    }

    public AuthResponse Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var existingUser = _store.All<AuthAccount>()
            .FirstOrDefault(x => x.Email.ToLower() == email);

        if (existingUser != null)
            throw new InvalidOperationException("Email already registered.");

        var account = new AuthAccount
        {
            Name = request.Name.Trim(),
            Email = email,
            Phone = !string.IsNullOrWhiteSpace(request.Phone) ? request.Phone.Trim() : null,
            Role = "Viewer",
            CreatedAt = DateTime.UtcNow
        };

        account.PasswordHash = _passwordHasher.HashPassword(
            account, request.Password);

        _store.Add<AuthAccount>(
            account, (item, id) => item.Id = id);

        return _tokenService.CreateToken(account);
    }

    public AuthResponse? Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var account = _store.All<AuthAccount>()
            .FirstOrDefault(x => x.Email.ToLower() == email);

        if (account == null || account.Status != "Active")
            return null;

        var result = _passwordHasher.VerifyHashedPassword(
            account,
            account.PasswordHash,
            request.Password);

        if (result == PasswordVerificationResult.Failed)
            return null;

        return _tokenService.CreateToken(account);
    }
}