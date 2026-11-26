namespace HumanitarianCrisis.API.Models;

public sealed class PasswordResetToken
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
