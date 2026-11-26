using System.Data;
using System.Security.Cryptography;
using System.Text;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Services;

public sealed class PasswordResetService(
    CrisisDbContext db,
    NotificationDeliveryService delivery,
    IConfiguration configuration,
    ILogger<PasswordResetService> logger)
{
    private static readonly PasswordHasher<AuthAccount> PasswordHasher = new();

    public async Task RequestResetAsync(string email, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var account = await db.Accounts.FirstOrDefaultAsync(
            item => item.Email.ToLower() == normalizedEmail && item.Status == "Active",
            cancellationToken);

        // Keep the public response identical for existing and unknown email addresses.
        if (account is null) return;

        var now = DateTime.UtcNow;
        var recentlyRequested = await db.PasswordResetTokens.AnyAsync(
            item => item.AccountId == account.Id && item.CreatedAt >= now.AddMinutes(-1),
            cancellationToken);
        if (recentlyRequested) return;

        var rawToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

        await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            var previousTokens = await db.PasswordResetTokens
                .Where(item => item.AccountId == account.Id && item.UsedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var previous in previousTokens) previous.UsedAt = now;

            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                AccountId = account.Id,
                TokenHash = tokenHash,
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(30)
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        var frontendBaseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var resetUrl = $"{frontendBaseUrl}/?resetToken={Uri.EscapeDataString(rawToken)}";
        var body = $"A request was made to reset your HUMANAID password.\n\n" +
                   $"Open this link within 30 minutes to set a new password:\n{resetUrl}\n\n" +
                   "If you did not request this, you can ignore this email. Your password will not change.";

        var result = await delivery.SendAsync(
            "Email", account.Email, "Reset your HUMANAID password", body, cancellationToken);
        if (result.Status != "Sent")
            logger.LogWarning("Password reset email could not be delivered for account {AccountId}.", account.Id);
    }

    public async Task<bool> ResetPasswordAsync(string rawToken, string newPassword, CancellationToken cancellationToken)
    {
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var resetToken = await db.PasswordResetTokens.FirstOrDefaultAsync(
            item => item.TokenHash == tokenHash && item.UsedAt == null && item.ExpiresAt > DateTime.UtcNow,
            cancellationToken);
        if (resetToken is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        var account = await db.Accounts.FirstOrDefaultAsync(
            item => item.Id == resetToken.AccountId && item.Status == "Active",
            cancellationToken);
        if (account is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        account.PasswordHash = PasswordHasher.HashPassword(account, newPassword);
        resetToken.UsedAt = DateTime.UtcNow;
        var otherTokens = await db.PasswordResetTokens
            .Where(item => item.AccountId == account.Id && item.Id != resetToken.Id && item.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var other in otherTokens) other.UsedAt = resetToken.UsedAt;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }
}
