using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.DTOs;

public sealed class AiDecisionRequest
{
    [Range(1, int.MaxValue)]
    public int RequestId { get; set; }

    [Required, StringLength(2000)]
    public string Recommendation { get; set; } = string.Empty;

    [Range(0, 1)]
    public double Confidence { get; set; }

    [Required, AllowedValues("Accepted", "Modified", "Rejected", "Deferred")]
    public string Decision { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? AppliedValue { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}
