using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/organizations")]
public sealed class OrganizationController : CrudController<Organization>
{
    public OrganizationController(CrisisStore store) : base(store) { }

    protected override int GetId(Organization item) => item.Id;

    protected override void SetId(Organization item, int id) => item.Id = id;
}