using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.DTOs;

public sealed class ForgotPasswordRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; set; } = string.Empty;
}
