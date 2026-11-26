using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

public sealed class VolunteerMissionAssignment
{
    public int Id { get; set; }
    public int EmergencyRequestId { get; set; }
    public int VolunteerAccountId { get; set; }
    [Required, StringLength(150)] public string VolunteerName { get; set; } = string.Empty;
    [Required, StringLength(20)] public string Status { get; set; } = "In Progress";
    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
