using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.DTOs;

public sealed class ResetPasswordRequest
{
    [Required, MinLength(32), MaxLength(128)]
    public string Token { get; set; } = string.Empty;

    [Required, MinLength(8), MaxLength(128)]
    public string NewPassword { get; set; } = string.Empty;
}
