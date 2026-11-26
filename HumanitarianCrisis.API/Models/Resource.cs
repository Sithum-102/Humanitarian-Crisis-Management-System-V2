using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public class Resource
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Resource name is required."), StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [AllowedValues("Food", "Water", "Medical", "Shelter", "General", "Supplies", ErrorMessage = "Invalid resource category.")]
    public string Category { get; set; } = "General";

    [Range(0, 100_000_000, ErrorMessage = "Resource quantity cannot be negative.")]
    public int Quantity { get; set; }

    [StringLength(30)]
    public string Unit { get; set; } = "units";

    [StringLength(200)]
    public string Location { get; set; } = "";

    [AllowedValues("Available", "Low stock", "Out of stock", "Reserved", ErrorMessage = "Invalid resource status.")]
    public string Status { get; set; } = "Available";
}
