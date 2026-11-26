using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Organization
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Organization name is required."), StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [AllowedValues("NGO", "Healthcare", "Government", "Community", ErrorMessage = "Invalid organization type.")]
    public string Type { get; set; } = "NGO";

    [StringLength(200)]
    public string Location { get; set; } = "";

    [StringLength(200)]
    public string Contact { get; set; } = "";

    [AllowedValues("Pending", "Verified", "Active", "Inactive", ErrorMessage = "Invalid organization status.")]
    public string Status { get; set; } = "Active";
}
