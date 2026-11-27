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

    protected override void OnCreate(Volunteer item)
    {
        NormalizePhone(item);
    }

    protected override void OnUpdate(Volunteer item, Volunteer existing)
    {
        NormalizePhone(item);
    }

    private static void NormalizePhone(Volunteer item)
    {
        if (string.IsNullOrWhiteSpace(item.Phone)) return;
        var compact = new string(item.Phone.Trim().Where(c => !char.IsWhiteSpace(c) && c != '-' && c != '(' && c != ')' && c != '.').ToArray());
        if (compact.StartsWith("00", StringComparison.Ordinal)) compact = "+" + compact[2..];
        else if (compact.StartsWith('0')) compact = "+94" + compact[1..];
        else if (compact.Length == 9 && compact.All(char.IsDigit)) compact = "+94" + compact;
        else if (compact.StartsWith("94", StringComparison.Ordinal)) compact = "+" + compact;
        if (System.Text.RegularExpressions.Regex.IsMatch(compact, @"^\+[1-9]\d{7,14}$"))
            item.Phone = compact;
    }
}