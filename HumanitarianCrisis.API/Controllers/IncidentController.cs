using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/incidents")]
public sealed class IncidentController : CrudController<Incident>
{
    public IncidentController(CrisisStore store) : base(store) { }

    protected override int GetId(Incident item) => item.Id;

    protected override void SetId(Incident item, int id) => item.Id = id;

    protected override void OnCreate(Incident item)
    {
        item.ReportedAt = DateTime.UtcNow;
        item.ResolvedAt = IsResolved(item) ? DateTime.UtcNow : null;
    }

    protected override void OnUpdate(Incident item, Incident existing)
    {
        item.ReportedAt = existing.ReportedAt;
        item.ResolvedAt = IsResolved(item) ? existing.ResolvedAt ?? DateTime.UtcNow : null;
    }

    private static bool IsResolved(Incident incident) => incident.Status == "Resolved";
}
