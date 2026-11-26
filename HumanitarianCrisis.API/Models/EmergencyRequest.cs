using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class EmergencyRequest
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Requester name is required."), StringLength(150)]
    public string RequesterName { get; set; } = "";

    [StringLength(254), EmailAddress]
    public string? RequesterEmail { get; set; }

    [StringLength(32)]
    public string? RequesterPhone { get; set; }

    [StringLength(2)]
    public string RequesterLanguage { get; set; } = "en";

    // Only a SHA-256 hash is stored. The raw tracking code is returned once to the requester.
    [StringLength(64)]
    public string? TrackingCodeHash { get; set; }

    [StringLength(200)]
    public string Location { get; set; } = "";

    [AllowedValues("Food", "Water", "Medical", "Shelter", "General", ErrorMessage = "Invalid request category.")]
    public string Category { get; set; } = "General";

    [Required(ErrorMessage = "Please describe the assistance needed."), StringLength(2000)]
    public string Description { get; set; } = "";

    [AllowedValues("Low", "Medium", "High", "Critical", ErrorMessage = "Priority must be Low, Medium, High or Critical.")]
    public string Priority { get; set; } = "Medium";

    [AllowedValues("Pending", "Approved", "In Progress", "Completed", "Rejected", ErrorMessage = "Invalid request status.")]
    public string Status { get; set; } = "Pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
