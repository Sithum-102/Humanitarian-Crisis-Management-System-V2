using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Shelter : IValidatableObject
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Shelter name is required."), StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [StringLength(200)]
    public string Location { get; set; } = "";

    [Range(0, 1_000_000, ErrorMessage = "Capacity must be zero or more.")]
    public int Capacity { get; set; }

    [Range(0, 1_000_000, ErrorMessage = "Occupancy must be zero or more.")]
    public int Occupancy { get; set; }

    [AllowedValues("Open", "Full", "Closed", ErrorMessage = "Invalid shelter status.")]
    public string Status { get; set; } = "Open";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Occupancy > Capacity)
            yield return new ValidationResult(
                "Shelter occupancy cannot exceed capacity.",
                new[] { nameof(Occupancy) });
    }
}
