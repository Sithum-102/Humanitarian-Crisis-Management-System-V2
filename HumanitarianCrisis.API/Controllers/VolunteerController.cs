using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/volunteers")]
public sealed class VolunteerController : CrudController<Volunteer>
{
    public VolunteerController(CrisisStore store) : base(store) { }

    protected override int GetId(Volunteer item) => item.Id;

    protected override void SetId(Volunteer item, int id) => item.Id = id;
}