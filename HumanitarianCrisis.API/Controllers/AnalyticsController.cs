using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
public sealed class AnalyticsController(CrisisStore store) : ControllerBase
{
    [HttpGet("incidents")]
    public IActionResult Incidents()
    {
        var incidents = store.All<Incident>();

        return Ok(new
        {
            bySeverity = incidents
                .GroupBy(i => i.Severity)
                .Select(g => new
                {
                    label = g.Key,
                    count = g.Count()
                })
                .ToList(),

            byStatus = incidents
                .GroupBy(i => i.Status)
                .Select(g => new
                {
                    label = g.Key,
                    count = g.Count()
                })
                .ToList(),

            byDay = incidents
                .GroupBy(i => i.ReportedAt.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    date = g.Key.ToString("yyyy-MM-dd"),
                    count = g.Count()
                })
                .ToList()
        });
    }
}