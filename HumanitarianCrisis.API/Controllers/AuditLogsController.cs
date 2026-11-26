using System.Security.Claims;
using HumanitarianCrisis.API.DTOs;
using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/auditlogs")]
[Authorize(Roles = "Admin,Coordinator")]
public sealed class AuditLogsController(CrisisStore store) : ControllerBase
{
    [HttpGet]
    public ActionResult<List<AuditLog>> GetForEntity([FromQuery] string entityType, [FromQuery] int entityId)
    {
        if (string.IsNullOrWhiteSpace(entityType) || entityId <= 0)
            return BadRequest(new { message = "Entity type and a valid entity ID are required." });

        return Ok(store.GetAuditHistory(entityType, entityId));
    }

    [HttpPost("ai-decision")]
    public IActionResult RecordAiDecision([FromBody] AiDecisionRequest request)
    {
        var emergencyRequest = store.Find<EmergencyRequest>(request.RequestId, x => x.Id);
        if (emergencyRequest is null)
            return NotFound(new { message = "Emergency request not found." });

        int? actorId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        var decision = request.Decision.Trim();
        var log = new AuditLog
        {
            EntityType = nameof(EmergencyRequest),
            EntityId = request.RequestId,
            Action = $"AIRecommendation{decision}",
            ActorUserId = actorId,
            ActorName = User.Identity?.Name ?? User.FindFirstValue(ClaimTypes.Email) ?? "Authorized user",
            ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "Unknown",
            FromValue = request.Recommendation,
            ToValue = request.AppliedValue,
            Details = string.IsNullOrWhiteSpace(request.Notes)
                ? $"AI recommendation {decision.ToLowerInvariant()} by human reviewer."
                : request.Notes.Trim(),
            Recommendation = request.Recommendation.Trim(),
            Confidence = request.Confidence,
            OccurredAt = DateTime.UtcNow
        };

        store.AddAudit(log);
        return Ok(log);
    }
}
