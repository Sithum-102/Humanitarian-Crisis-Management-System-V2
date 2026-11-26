using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

/// <summary>Immutable record of a humanitarian workflow action.</summary>
public sealed class AuditLog
{
    public int Id { get; set; }

    [Required, StringLength(100)]
    public string EntityType { get; set; } = string.Empty;

    public int EntityId { get; set; }

    [Required, StringLength(80)]
    public string Action { get; set; } = string.Empty;

    public int? ActorUserId { get; set; }

    [Required, StringLength(254)]
    public string ActorName { get; set; } = string.Empty;

    [Required, StringLength(80)]
    public string ActorRole { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? FromValue { get; set; }

    [StringLength(1000)]
    public string? ToValue { get; set; }

    [StringLength(2000)]
    public string? Details { get; set; }

    [StringLength(2000)]
    public string? Recommendation { get; set; }

    [Range(0, 1)]
    public double? Confidence { get; set; }

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}
