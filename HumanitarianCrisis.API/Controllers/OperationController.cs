using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/operations")]
public sealed class OperationController : CrudController<Operation>
{
    public OperationController(CrisisStore store) : base(store) { }

    protected override int GetId(Operation item) => item.Id;

    protected override void SetId(Operation item, int id) => item.Id = id;

    protected override void OnCreate(Operation item) => item.StartedAt = DateTime.UtcNow;

    protected override void OnUpdate(Operation item, Operation existing)
        => item.StartedAt = existing.StartedAt;
}
