using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Volunteer
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Volunteer name is required."), StringLength(150, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [StringLength(100)]
    public string Skill { get; set; } = "General";

    [StringLength(200)]
    public string Location { get; set; } = "";

    [StringLength(40)]
    public string Phone { get; set; } = "";

    [AllowedValues("Available", "On assignment", "Unavailable", ErrorMessage = "Invalid volunteer availability.")]
    public string Status { get; set; } = "Available";
}
