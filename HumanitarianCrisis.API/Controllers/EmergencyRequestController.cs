using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.DTOs;
using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/emergencyrequests")]
public sealed class EmergencyRequestController(CrisisStore store, CrisisDbContext db, NotificationDeliveryService delivery, ILogger<EmergencyRequestController> logger) : CrudController<EmergencyRequest>(store)
{
    protected override int GetId(EmergencyRequest item) => item.Id;
    protected override void SetId(EmergencyRequest item, int id) => item.Id = id;
    protected override void OnCreate(EmergencyRequest item) => item.CreatedAt = DateTime.UtcNow;
    protected override void OnUpdate(EmergencyRequest item, EmergencyRequest existing)
    {
        item.CreatedAt = existing.CreatedAt;
        item.RequesterEmail = existing.RequesterEmail;
        item.RequesterPhone = existing.RequesterPhone;
        item.RequesterLanguage = existing.RequesterLanguage;
        item.TrackingCodeHash = existing.TrackingCodeHash;
    }

    [AllowAnonymous]
    [EnableRateLimiting("sos")]
    [HttpPost("public")]
    public async Task<ActionResult> SubmitPublic([FromBody] EmergencyRequest item, CancellationToken ct)
    {
        if (!TryNormalizePhone(item.RequesterPhone, out var normalizedPhone))
            return BadRequest(new { message = "Enter a valid phone number, for example 0771234567 or +94771234567." });
        item.Id = 0;
        item.RequesterName = string.IsNullOrWhiteSpace(item.RequesterName) ? "Affected Citizen" : item.RequesterName.Trim();
        item.RequesterEmail = string.IsNullOrWhiteSpace(item.RequesterEmail) ? null : item.RequesterEmail.Trim().ToLowerInvariant();
        item.RequesterPhone = normalizedPhone;
        item.RequesterLanguage = item.RequesterLanguage is "si" or "ta" ? item.RequesterLanguage : "en";
        item.Location = item.Location?.Trim() ?? string.Empty;
        item.Description = item.Description.Trim();
        item.Status = "Pending";
        item.CreatedAt = DateTime.UtcNow;
        var trackingCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        item.TrackingCodeHash = HashCode(trackingCode);
        var audit = MakeAudit(item, "Submitted", "", "Pending", "Public emergency assistance request submitted.", "Public");
        var created = Store.Add(item, SetId, audit);
        string notice;
        try { notice = await NotifyAsync(created, "Request received", "", ct, trackingCode); }
        catch (Exception ex)
        {
            logger.LogError(ex, "The request was saved, but its acknowledgement could not be recorded for request {RequestId}.", created.Id);
            notice = "Notification could not be recorded. Save the tracking code shown below.";
        }
        var responseMessage = item.RequesterLanguage switch
        {
            "si" => "ඔබගේ ඉල්ලීම ලැබී ඇත. එය නිලධාරියෙකු විසින් සමාලෝචනය කිරීමට නියමිතයි. තත්ත්වය බැලීමට මෙම පුද්ගලික කේතය සුරකින්න.",
            "ta" => "உங்கள் கோரிக்கை பெறப்பட்டது. அதிகாரி ஒருவர் அதை மதிப்பாய்வு செய்வார். நிலையைப் பார்க்க இந்தத் தனிப்பட்ட குறியீட்டைச் சேமிக்கவும்.",
            _ => "Your request was received and is waiting for officer review. Save this private code to track its status."
        };
        return Created($"/api/emergencyrequests/public/{created.Id}/status", new { id = created.Id, status = created.Status, trackingCode, message = responseMessage, notification = notice });
    }

    [AllowAnonymous]
    [EnableRateLimiting("sos")]
    [HttpGet("public/{id:int}/status")]
    public async Task<IActionResult> GetPublicStatus(int id, [FromQuery] string code, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length > 100) return NotFound();
        var request = await db.EmergencyRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (request?.TrackingCodeHash is null || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(request.TrackingCodeHash), Encoding.UTF8.GetBytes(HashCode(code)))) return NotFound();
        var history = await db.AuditLogs.AsNoTracking().Where(x => x.EntityType == nameof(EmergencyRequest) && x.EntityId == id).OrderBy(x => x.OccurredAt).Select(x => new { x.Action, x.ToValue, x.OccurredAt }).ToListAsync(ct);
        history = history.Where(x => x.Action is "Verified" or "Assigned" or "Closed" or "Rejected").ToList();
        return Ok(new { request.Id, request.Status, request.CreatedAt, history });
    }

    [Authorize(Roles = "Admin,Coordinator,Authorized Officer,AuthorizedOfficer")]
    [HttpPost("{id:int}/verify")]
    public async Task<IActionResult> Verify(int id, CancellationToken ct)
    {
        var request = await db.EmergencyRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound(new { message = "Request not found." });
        if (request.Status != "Pending") return Conflict(new { message = "Only pending requests can be verified." });
        var old = request.Status;
        request.Status = "Approved";
        var actor = ActorName();
        db.AuditLogs.Add(MakeAudit(request, "Verified", old, request.Status, "Officer verified the request details and approved it for resource planning."));
        await db.SaveChangesAsync(ct);
        var notice = await NotifyAsync(request, "Request verified", $"HUMANAID request #{id}: your request was verified. The response team is planning assistance.", ct);
        return Ok(new { request.Id, request.Status, notification = notice });
    }

    [Authorize(Roles = "Admin,Coordinator,Authorized Officer,AuthorizedOfficer")]
    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectRequest input, CancellationToken ct)
    {
        var request = await db.EmergencyRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound(new { message = "Request not found." });
        if (request.Status is not ("Pending" or "Approved"))
            return Conflict(new { message = "Only pending or approved requests can be rejected." });
        if (string.IsNullOrWhiteSpace(input.Reason))
            return BadRequest(new { message = "Provide a clear reason and tell the requester what information or action is needed." });

        var reason = input.Reason.Trim();
        var old = request.Status;
        request.Status = "Rejected";
        db.AuditLogs.Add(MakeAudit(request, "Rejected", old, request.Status,
            $"Officer rejected the request. Reason: {reason}"));
        await db.SaveChangesAsync(ct);

        var notice = await NotifyAsync(request, "Request needs more information",
            $"Your request was not approved yet. Reason: {reason} Please provide the missing or corrected information and submit a new request, or contact the response team.", ct);
        return Ok(new { request.Id, request.Status, reason, notification = notice });
    }

    [Authorize(Roles = "Admin,Coordinator,Authorized Officer,AuthorizedOfficer")]
    [HttpPost("{id:int}/assign")]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignEmergencyRequest input, CancellationToken ct)
    {
        var request = await db.EmergencyRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound(new { message = "Request not found." });
        if (request.Status is not ("Approved" or "Pending")) return Conflict(new { message = "Verify or approve the request before assigning a response." });
        if (await db.Set<RequestAssignment>().AnyAsync(x => x.EmergencyRequestId == id, ct)) return Conflict(new { message = "A response allocation is already assigned to this case." });
        if (input.ResourceQuantity > 0 && input.ResourceId is null) return BadRequest(new { message = "Select a resource for the requested quantity." });
        if (input.ShelterPeople > 0 && input.ShelterId is null) return BadRequest(new { message = "Select a shelter for the people count." });
        if (input.ResourceQuantity == 0 && input.ShelterPeople == 0 && input.VolunteerIds.Count == 0 && string.IsNullOrWhiteSpace(input.TeamName)) return BadRequest(new { message = "Assign at least one resource, shelter place, volunteer, or response team." });

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        Resource? resource = null;
        Shelter? shelter = null;
        var volunteers = new List<Volunteer>();
        if (input.ResourceQuantity > 0)
        {
            resource = await db.Resources.FirstOrDefaultAsync(x => x.Id == input.ResourceId, ct);
            if (resource is null) return NotFound(new { message = "Selected resource not found." });
            if (resource.Quantity < input.ResourceQuantity) return Conflict(new { message = $"Only {resource.Quantity} {resource.Unit} are currently available." });
            resource.Quantity -= input.ResourceQuantity;
            resource.Status = resource.Quantity == 0 ? "Out of stock" : resource.Quantity < 50 ? "Low stock" : "Available";
        }
        if (input.ShelterPeople > 0)
        {
            shelter = await db.Shelters.FirstOrDefaultAsync(x => x.Id == input.ShelterId, ct);
            if (shelter is null) return NotFound(new { message = "Selected shelter not found." });
            if (shelter.Status == "Closed" || shelter.Capacity - shelter.Occupancy < input.ShelterPeople) return Conflict(new { message = "The selected shelter does not have enough available places." });
            shelter.Occupancy += input.ShelterPeople;
            shelter.Status = shelter.Occupancy >= shelter.Capacity ? "Full" : "Open";
        }
        var volunteerIds = input.VolunteerIds.Distinct().ToArray();
        if (volunteerIds.Length > 0)
        {
            volunteers = await db.Volunteers.Where(x => volunteerIds.Contains(x.Id)).ToListAsync(ct);
            if (volunteers.Count != volunteerIds.Length) return BadRequest(new { message = "One or more selected volunteers do not exist." });
            var unavailable = volunteers.FirstOrDefault(x => x.Status != "Available");
            if (unavailable is not null) return Conflict(new { message = $"{unavailable.Name} is not available for assignment." });
            volunteers.ForEach(x => x.Status = "On assignment");
        }

        var oldStatus = request.Status;
        request.Status = "In Progress";
        var actorEmail = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        db.Set<RequestAssignment>().Add(new RequestAssignment
        {
            EmergencyRequestId = id, ResourceId = resource?.Id, ResourceQuantity = input.ResourceQuantity,
            ShelterId = shelter?.Id, ShelterPeople = input.ShelterPeople,
            VolunteerIdsJson = JsonSerializer.Serialize(volunteerIds), TeamName = input.TeamName?.Trim() ?? string.Empty,
            AssignedByEmail = actorEmail, AssignedAt = DateTime.UtcNow
        });
        db.Operations.Add(new Operation
        {
            Title = $"Response for request #{id}", Location = request.Location,
            Team = string.IsNullOrWhiteSpace(input.TeamName) ? string.Join(", ", volunteers.Select(x => x.Name)) : input.TeamName.Trim(),
            Status = "In Progress", StartedAt = DateTime.UtcNow
        });
        var allocationText = string.Join("; ", new[] {
            resource is null ? null : $"{input.ResourceQuantity} {resource.Unit} of {resource.Name}",
            shelter is null ? null : $"{input.ShelterPeople} places at {shelter.Name}",
            volunteers.Count == 0 ? null : $"volunteers: {string.Join(", ", volunteers.Select(x => x.Name))}",
            string.IsNullOrWhiteSpace(input.TeamName) ? null : $"team: {input.TeamName.Trim()}"
        }.Where(x => x is not null));
        db.AuditLogs.Add(MakeAudit(request, "Assigned", oldStatus, "In Progress", $"Officer assigned response. {allocationText}"));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var deliveryStatus = await NotifyAsync(request, "Response assigned", $"HUMANAID request #{id}: a response has been assigned and your case is now In Progress.", ct);
        return Ok(new { request.Id, request.Status, assignment = new { resourceId = resource?.Id, resourceQuantity = input.ResourceQuantity, shelterId = shelter?.Id, shelterPeople = input.ShelterPeople, volunteerIds, teamName = input.TeamName }, notification = deliveryStatus });
    }

    [Authorize(Roles = "Admin,Coordinator,Authorized Officer,AuthorizedOfficer")]
    [HttpPost("{id:int}/close")]
    public async Task<IActionResult> Close(int id, [FromBody] CloseRequest input, CancellationToken ct)
    {
        var request = await db.EmergencyRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (request is null) return NotFound(new { message = "Request not found." });
        if (request.Status is "Completed" or "Rejected") return Conflict(new { message = "This case is already closed." });
        var allocation = await db.Set<RequestAssignment>().FirstOrDefaultAsync(x => x.EmergencyRequestId == id, ct);
        if (allocation is not null)
        {
            var volunteerIds = JsonSerializer.Deserialize<int[]>(allocation.VolunteerIdsJson) ?? [];
            var assigned = await db.Volunteers.Where(x => volunteerIds.Contains(x.Id) && x.Status == "On assignment").ToListAsync(ct);
            assigned.ForEach(x => x.Status = "Available");
            var operation = await db.Operations.Where(x => x.Title == $"Response for request #{id}" && x.Status == "In Progress").OrderByDescending(x => x.Id).FirstOrDefaultAsync(ct);
            if (operation is not null) operation.Status = "Completed";
        }
        var old = request.Status;
        request.Status = "Completed";
        var details = string.IsNullOrWhiteSpace(input.Outcome) ? "Officer closed the case after response." : $"Officer closed the case. Outcome: {input.Outcome.Trim()}";
        db.AuditLogs.Add(MakeAudit(request, "Closed", old, request.Status, details));
        await db.SaveChangesAsync(ct);
        var notice = await NotifyAsync(request, "Case closed", $"HUMANAID request #{id}: your case has been marked Completed. {input.Outcome?.Trim()}".Trim(), ct);
        return Ok(new { request.Id, request.Status, notification = notice });
    }

    public sealed class CloseRequest { [System.ComponentModel.DataAnnotations.StringLength(1000)] public string? Outcome { get; set; } }
    public sealed class RejectRequest
    {
        [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(1000, MinimumLength = 5)]
        public string Reason { get; set; } = string.Empty;
    }

    private AuditLog MakeAudit(EmergencyRequest request, string action, string? from, string? to, string details, string role = "Coordinator") => new()
    {
        EntityType = nameof(EmergencyRequest), EntityId = request.Id, Action = action,
        ActorUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId) ? actorId : null,
        ActorName = action == "Submitted" ? request.RequesterName : ActorName(), ActorRole = role == "Public" ? role : (User.FindFirstValue(ClaimTypes.Role) ?? role),
        FromValue = from, ToValue = to, Details = details, OccurredAt = DateTime.UtcNow
    };
    private string ActorName() => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? "Authorized Officer";
    private static string HashCode(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

    private async Task<string> NotifyAsync(EmergencyRequest request, string subject, string message, CancellationToken ct, string? trackingCode = null)
    {
        var localized = LocalizeNotice(request, subject, message, trackingCode);
        var recipients = new List<(string Channel, string Address, int? AccountId)>();
        if (!string.IsNullOrWhiteSpace(request.RequesterEmail))
        {
            var account = await db.Accounts.AsNoTracking().FirstOrDefaultAsync(x => x.Email == request.RequesterEmail, ct);
            recipients.Add(("Email", request.RequesterEmail, account?.Id));
        }
        if (!string.IsNullOrWhiteSpace(request.RequesterPhone)) recipients.Add(("SMS", request.RequesterPhone, null));
        if (recipients.Count == 0) return "No email or mobile number was provided.";

        var outcomes = new List<string>();
        foreach (var recipient in recipients)
        {
            var record = new NotificationRecord
            {
                RecipientAccountId = recipient.AccountId, Recipient = recipient.Address, RecipientName = request.RequesterName,
                Channel = recipient.Channel, Subject = localized.Subject, Message = localized.Message, Status = "Queued", Attempts = 0,
                CreatedByAccountId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId) ? actorId : 0,
                CreatedByName = User.Identity?.IsAuthenticated == true ? ActorName() : "HUMANAID System", CreatedAt = DateTime.UtcNow
            };
            db.Notifications.Add(record);
            await db.SaveChangesAsync(ct);
            var result = await delivery.SendAsync(recipient.Channel, recipient.Address, localized.Subject, localized.Message, ct);
            record.Attempts = 1; record.Status = result.Status; record.LastError = result.Error; record.SentAt = result.Status == "Sent" ? DateTime.UtcNow : null;
            await db.SaveChangesAsync(ct);
            outcomes.Add($"{recipient.Channel}: {result.Status}");
            if (result.Status != "Sent") logger.LogInformation("Workflow {Channel} for request {RequestId}: {Status}", recipient.Channel, request.Id, result.Status);
        }
        return string.Join("; ", outcomes);
    }

    private static (string Subject, string Message) LocalizeNotice(EmergencyRequest request, string subject, string originalMessage, string? trackingCode)
    {
        var id = request.Id;
        if (request.RequesterLanguage == "si")
        {
            return subject switch
            {
                "Request received" => ("ඉල්ලීම ලැබුණා", $"HUMANAID: ඔබගේ #{id} අංක දරන {request.Category} ආධාර ඉල්ලීම ලැබී ඇත. තත්ත්වය: සමාලෝචනය බලාපොරොත්තුවෙන්. මෙය ආධාර යවා ඇති බවට තහවුරු කිරීමක් නොවේ. ලුහුබැඳීමේ කේතය: {trackingCode}."),
                "Request verified" => ("ඉල්ලීම තහවුරු කළා", $"HUMANAID ඉල්ලීම #{id}: ඔබගේ ඉල්ලීම තහවුරු කර ඇත. නිලධාරීන් ප්‍රතිචාරය සැලසුම් කරමින් සිටී."),
                "Response assigned" => ("ප්‍රතිචාර කණ්ඩායම පවරා ඇත", $"HUMANAID ඉල්ලීම #{id}: ප්‍රතිචාර කණ්ඩායමක් පවරා ඇත. ඔබගේ ඉල්ලීම ක්‍රියාත්මක වෙමින් පවතී."),
                "Request needs more information" => ("තවත් තොරතුරු අවශ්‍යයි", $"HUMANAID ඉල්ලීම #{id}: ඔබගේ ඉල්ලීම මේ අවස්ථාවේ අනුමත කළ නොහැක. හේතුව: {originalMessage} කරුණාකර අවශ්‍ය/නිවැරදි තොරතුරු සමඟ නව ඉල්ලීමක් යොමු කරන්න හෝ ප්‍රතිචාර කණ්ඩායම අමතන්න."),
                "Case closed" => ("සිද්ධිය අවසන් කළා", $"HUMANAID ඉල්ලීම #{id}: ඔබගේ සිද්ධිය සම්පූර්ණ කළ ලෙස සලකුණු කර ඇත. {originalMessage}".Trim()),
                _ => (subject, messageFallback(request, subject, originalMessage))
            };
        }
        if (request.RequesterLanguage == "ta")
        {
            return subject switch
            {
                "Request received" => ("கோரிக்கை பெறப்பட்டது", $"HUMANAID: உங்கள் #{id} {request.Category} உதவி கோரிக்கை பெறப்பட்டது. நிலை: அதிகாரி மதிப்பாய்வுக்காக காத்திருக்கிறது. இது உதவி அனுப்பப்பட்டதற்கான உறுதி அல்ல. கண்காணிப்பு குறியீடு: {trackingCode}."),
                "Request verified" => ("கோரிக்கை சரிபார்க்கப்பட்டது", $"HUMANAID கோரிக்கை #{id}: உங்கள் கோரிக்கை சரிபார்க்கப்பட்டது. பதிலளிப்பை அதிகாரிகள் திட்டமிடுகின்றனர்."),
                "Response assigned" => ("பதிலளிப்பு குழு ஒதுக்கப்பட்டது", $"HUMANAID கோரிக்கை #{id}: பதிலளிப்பு குழு ஒதுக்கப்பட்டுள்ளது. உங்கள் கோரிக்கை செயல்பாட்டில் உள்ளது."),
                "Request needs more information" => ("கூடுதல் தகவல் தேவை", $"HUMANAID கோரிக்கை #{id}: இந்த நேரத்தில் உங்கள் கோரிக்கையை அங்கீகரிக்க முடியவில்லை. காரணம்: {originalMessage} தேவையான/திருத்தப்பட்ட தகவலுடன் புதிய கோரிக்கையைச் சமர்ப்பிக்கவும் அல்லது பதிலளிப்பு குழுவைத் தொடர்புகொள்ளவும்."),
                "Case closed" => ("வழக்கு முடிக்கப்பட்டது", $"HUMANAID கோரிக்கை #{id}: உங்கள் வழக்கு நிறைவு செய்யப்பட்டதாகக் குறிக்கப்பட்டுள்ளது. {originalMessage}".Trim()),
                _ => (subject, messageFallback(request, subject, originalMessage))
            };
        }
        var englishMessage = subject == "Request received"
            ? $"HUMANAID: We received your {request.Category} assistance request (case #{id}). Status: awaiting officer review. This is not confirmation that aid has been dispatched. Tracking code: {trackingCode}."
            : messageFallback(request, subject, originalMessage);
        return (subject, englishMessage);
    }

    private static string messageFallback(EmergencyRequest request, string subject, string originalMessage) => string.IsNullOrWhiteSpace(originalMessage) ? subject switch
    {
        "Request verified" => $"HUMANAID request #{request.Id}: your request was verified. The response team is planning assistance.",
        "Response assigned" => $"HUMANAID request #{request.Id}: a response has been assigned and your case is now In Progress.",
        "Request needs more information" => $"HUMANAID request #{request.Id}: we could not approve your request yet. Please provide the missing or corrected information and submit a new request, or contact the response team.",
        "Case closed" => $"HUMANAID request #{request.Id}: your case has been marked Completed.",
        _ => $"HUMANAID request #{request.Id}: {subject}."
    } : originalMessage;

    private static bool TryNormalizePhone(string? input, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(input)) return true;
        var compact = new string(input.Trim().Where(c => !char.IsWhiteSpace(c) && c != '-' && c != '(' && c != ')').ToArray());
        if (compact.StartsWith("00", StringComparison.Ordinal)) compact = "+" + compact[2..];
        else if (compact.StartsWith('0')) compact = "+94" + compact[1..];
        else if (compact.Length == 9 && compact.All(char.IsDigit)) compact = "+94" + compact;
        else if (compact.StartsWith("94", StringComparison.Ordinal)) compact = "+" + compact;
        if (!System.Text.RegularExpressions.Regex.IsMatch(compact, @"^\+[1-9]\d{7,14}$")) return false;
        normalized = compact;
        return true;
    }
}
