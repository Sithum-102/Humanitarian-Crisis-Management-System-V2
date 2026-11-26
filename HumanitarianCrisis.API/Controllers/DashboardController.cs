using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController(CrisisStore store) : ControllerBase
{
    [HttpGet("summary")]
    public IActionResult Summary()
    {
        var incidents = store.All<Incident>();
        var requests = store.All<EmergencyRequest>();
        var shelters = store.All<Shelter>();

        return Ok(new
        {
            totalIncidents = incidents.Count,

            activeIncidents = incidents.Count(
                i => !i.Status.Equals(
                    "Resolved",
                    StringComparison.OrdinalIgnoreCase)),

            criticalIncidents = incidents.Count(
                i => i.Severity.Equals(
                    "Critical",
                    StringComparison.OrdinalIgnoreCase)),

            pendingRequests = requests.Count(
                r => r.Status.Equals(
                    "Pending",
                    StringComparison.OrdinalIgnoreCase)),

            availableVolunteers = store.All<Volunteer>().Count(
                v => v.Status.Equals(
                    "Available",
                    StringComparison.OrdinalIgnoreCase)),

            totalResources = store.All<Resource>().Count,

            totalShelters = shelters.Count,

            shelterOccupancy = shelters.Sum(s => s.Occupancy),

            shelterCapacity = shelters.Sum(s => s.Capacity)
        });
    }
}