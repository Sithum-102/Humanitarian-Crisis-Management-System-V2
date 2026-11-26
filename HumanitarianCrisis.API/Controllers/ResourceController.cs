using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/resources")]
public sealed class ResourceController : CrudController<Resource>
{
    public ResourceController(CrisisStore store) : base(store) { }

    protected override int GetId(Resource item) => item.Id;

    protected override void SetId(Resource item, int id) => item.Id = id;
}