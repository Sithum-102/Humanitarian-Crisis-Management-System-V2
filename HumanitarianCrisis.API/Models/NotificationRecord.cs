using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public sealed class NotificationRecord
{
    public int Id { get; set; }
    public int? RecipientAccountId { get; set; }
    [Required, StringLength(254)] public string Recipient { get; set; } = string.Empty;
    [StringLength(150)] public string RecipientName { get; set; } = string.Empty;
    [Required, StringLength(10)] public string Channel { get; set; } = string.Empty;
    [StringLength(200)] public string Subject { get; set; } = string.Empty;
    [Required, StringLength(4000)] public string Message { get; set; } = string.Empty;
    [Required, StringLength(20)] public string Status { get; set; } = "Queued";
    public int Attempts { get; set; }
    [StringLength(500)] public string? LastError { get; set; }
    public int CreatedByAccountId { get; set; }
    [Required, StringLength(150)] public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public DateTime? ReadAt { get; set; }
}
