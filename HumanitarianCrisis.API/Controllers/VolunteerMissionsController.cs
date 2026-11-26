using System.Security.Claims;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Coordinator,Volunteer,Viewer")]
[Route("api/volunteermissions")]
public sealed class VolunteerMissionsController(CrisisDbContext db) : ControllerBase
{
    private int? AccountId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpGet("open")]
    public ActionResult<List<EmergencyRequest>> GetOpen()
    {
        var claimedIds = db.VolunteerMissionAssignments.Select(x => x.EmergencyRequestId);
        var requests = db.EmergencyRequests.AsNoTracking()
            .Where(x => (x.Status == "Pending" || x.Status == "Approved") && !claimedIds.Contains(x.Id))
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
        return Ok(requests);
    }

    [HttpGet("mine")]
    public ActionResult<List<EmergencyRequest>> GetMine()
    {
        if (AccountId is not int accountId) return Unauthorized();
        var requestIds = db.VolunteerMissionAssignments.AsNoTracking()
            .Where(x => x.VolunteerAccountId == accountId && x.Status == "In Progress")
            .Select(x => x.EmergencyRequestId);
        return Ok(db.EmergencyRequests.AsNoTracking().Where(x => requestIds.Contains(x.Id)).OrderByDescending(x => x.CreatedAt).ToList());
    }

    [HttpPost("{requestId:int}/claim")]
    public IActionResult Claim(int requestId)
    {
        if (AccountId is not int accountId) return Unauthorized();
        var request = db.EmergencyRequests.Find(requestId);
        if (request is null) return NotFound(new { message = "SOS request not found." });
        if (request.Status is not ("Pending" or "Approved"))
            return Conflict(new { message = "This SOS request is no longer available." });
        if (db.VolunteerMissionAssignments.Any(x => x.EmergencyRequestId == requestId))
            return Conflict(new { message = "Another volunteer has already accepted this mission." });

        var name = User.Identity?.Name ?? "Volunteer";
        var previousStatus = request.Status;
        using var transaction = db.Database.BeginTransaction();
        request.Status = "In Progress";
        db.VolunteerMissionAssignments.Add(new VolunteerMissionAssignment
        {
            EmergencyRequestId = requestId,
            VolunteerAccountId = accountId,
            VolunteerName = name,
            Status = "In Progress",
            ClaimedAt = DateTime.UtcNow
        });
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(EmergencyRequest),
            EntityId = requestId,
            Action = "VolunteerAccepted",
            ActorUserId = accountId,
            ActorName = name,
            ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "Volunteer",
            FromValue = previousStatus,
            ToValue = "In Progress",
            Details = "Volunteer accepted the SOS mission.",
            OccurredAt = DateTime.UtcNow
        });
        try
        {
            db.SaveChanges();
            transaction.Commit();
        }
        catch (DbUpdateException)
        {
            transaction.Rollback();
            return Conflict(new { message = "Another volunteer has already accepted this mission." });
        }
        return Ok(request);
    }

    [HttpPost("{requestId:int}/complete")]
    public IActionResult Complete(int requestId)
    {
        if (AccountId is not int accountId) return Unauthorized();
        var assignment = db.VolunteerMissionAssignments.SingleOrDefault(x => x.EmergencyRequestId == requestId && x.VolunteerAccountId == accountId);
        if (assignment is null) return NotFound(new { message = "You do not have this mission assigned." });
        if (assignment.Status != "In Progress") return Conflict(new { message = "This mission is already complete." });
        var request = db.EmergencyRequests.Find(requestId);
        if (request is null) return NotFound(new { message = "SOS request not found." });

        using var transaction = db.Database.BeginTransaction();
        assignment.Status = "Completed";
        assignment.CompletedAt = DateTime.UtcNow;
        request.Status = "Completed";
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(EmergencyRequest),
            EntityId = requestId,
            Action = "VolunteerCompleted",
            ActorUserId = accountId,
            ActorName = User.Identity?.Name ?? assignment.VolunteerName,
            ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "Volunteer",
            FromValue = "In Progress",
            ToValue = "Completed",
            Details = "Volunteer marked the SOS mission complete.",
            OccurredAt = DateTime.UtcNow
        });
        db.SaveChanges();
        transaction.Commit();
        return Ok(request);
    }
}
