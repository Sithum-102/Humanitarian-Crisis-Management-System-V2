using System.ComponentModel.DataAnnotations;

namespace HumanitarianCrisis.API.DTOs;

public sealed class AssignEmergencyRequest
{
    public int? ResourceId { get; set; }
    [Range(0, 100_000_000)] public int ResourceQuantity { get; set; }
    public int? ShelterId { get; set; }
    [Range(0, 1_000_000)] public int ShelterPeople { get; set; }
    public List<int> VolunteerIds { get; set; } = [];
    [StringLength(150)] public string TeamName { get; set; } = string.Empty;
}
