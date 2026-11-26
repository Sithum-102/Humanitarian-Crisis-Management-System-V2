using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/shelters")]
public sealed class ShelterController : CrudController<Shelter>
{
    public ShelterController(CrisisStore store) : base(store) { }

    protected override int GetId(Shelter item) => item.Id;

    protected override void SetId(Shelter item, int id) => item.Id = id;
}