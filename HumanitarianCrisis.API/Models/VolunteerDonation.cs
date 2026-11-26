using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public sealed class VolunteerDonation
{
    public int Id { get; set; }

    [Required, StringLength(150)] public string DonorName { get; set; } = string.Empty;
    [Required, StringLength(32)] public string Phone { get; set; } = string.Empty;
    [EmailAddress, StringLength(254)] public string? Email { get; set; }
    [Required, StringLength(300)] public string Categories { get; set; } = string.Empty;
    [Required, StringLength(1500)] public string ItemsDescription { get; set; } = string.Empty;
    [Required, StringLength(200)] public string CollectionCenter { get; set; } = string.Empty;
    [Required, StringLength(20)] public string Status { get; set; } = "Pending";
    public bool PickupRequested { get; set; }
    public int? AssignedVolunteerId { get; set; }
    [StringLength(150)] public string? AssignedVolunteerName { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
