using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.Models;

/// <summary>Single reviewed allocation bundle for an emergency request.</summary>
public sealed class RequestAssignment
{
    public int Id { get; set; }
    public int EmergencyRequestId { get; set; }
    public int? ResourceId { get; set; }
    public int ResourceQuantity { get; set; }
    public int? ShelterId { get; set; }
    public int ShelterPeople { get; set; }
    [Required] public string VolunteerIdsJson { get; set; } = "[]";
    [StringLength(150)] public string TeamName { get; set; } = string.Empty;
    [StringLength(254)] public string AssignedByEmail { get; set; } = string.Empty;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}
