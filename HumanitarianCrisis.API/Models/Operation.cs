using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Operation
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Operation name is required."), StringLength(200, MinimumLength = 2)]
    public string Title { get; set; } = "";

    [StringLength(200)]
    public string Location { get; set; } = "";

    [StringLength(150)]
    public string Team { get; set; } = "";

    [AllowedValues("Planned", "In Progress", "On Hold", "Completed", ErrorMessage = "Invalid operation status.")]
    public string Status { get; set; } = "Planned";

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
}
