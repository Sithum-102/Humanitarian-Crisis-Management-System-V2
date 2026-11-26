using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Incident
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Incident title is required."), StringLength(200, MinimumLength = 2)]
    public string Title { get; set; } = "";

    [StringLength(2000)]
    public string Description { get; set; } = "";

    [Required(ErrorMessage = "Location is required."), StringLength(200)]
    public string Location { get; set; } = "";

    [AllowedValues("Low", "Medium", "High", "Critical", ErrorMessage = "Severity must be Low, Medium, High or Critical.")]
    public string Severity { get; set; } = "Medium";

    [AllowedValues("Reported", "Active", "Responding", "Monitoring", "In Progress", "Resolved", ErrorMessage = "Invalid incident status.")]
    public string Status { get; set; } = "Reported";

    [Range(0, 100_000_000, ErrorMessage = "People affected must be zero or more.")]
    public int PeopleAffected { get; set; }

    public DateTime ReportedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ResolvedAt { get; set; }
}
