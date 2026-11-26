using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.DTOs;

public sealed class SendNotificationRequest
{
    [StringLength(150)] public string? RecipientName { get; init; }
    [StringLength(254)] public string? Email { get; init; }
    [StringLength(30)] public string? Phone { get; init; }
    [Required, MinLength(1)] public List<string> Channels { get; init; } = [];
    [StringLength(200)] public string? Subject { get; init; }
    [Required, StringLength(4000, MinimumLength = 2)] public string Message { get; init; } = string.Empty;
}
