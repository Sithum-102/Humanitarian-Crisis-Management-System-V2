using System.Security.Claims;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Controllers;

public sealed class NotificationSendRequest
{
    public string? RecipientName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public List<string> Channels { get; set; } = new();
    public string? Subject { get; set; }
    public string Message { get; set; } = string.Empty;
}

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ControllerBase
{
    private readonly CrisisDbContext _db;
    private readonly NotificationDeliveryService _delivery;
    private readonly IConfiguration _configuration;

    public NotificationsController(CrisisDbContext db, NotificationDeliveryService delivery, IConfiguration configuration)
    {
        _db = db;
        _delivery = delivery;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 100, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 500) pageSize = 100;

        var total = await _db.Notifications.CountAsync(ct);
        var items = await _db.Notifications
            .AsNoTracking()
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new
        {
            items,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        var emailConfigured = !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:BrevoApiKey"])
            || !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:ResendApiKey"])
            || !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:SmtpHost"]);

        var hasNotifyLk = !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:NotifyLkUserId"])
            && !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:NotifyLkApiKey"]);
        var hasTextBee = !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:TextBeeApiKey"])
            && !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:TextBeeDeviceId"]);
        var hasTwilio = !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:TwilioAccountSid"])
            && !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:TwilioAuthToken"]);
        var hasGeneric = !string.IsNullOrWhiteSpace(_configuration["Notifications:Sms:GatewayUrl"]);

        var smsConfigured = hasNotifyLk || hasTextBee || hasTwilio || hasGeneric;
        var smsProvider = hasNotifyLk ? "Notify.lk" : hasTextBee ? "Android Gateway" : hasTwilio ? "Twilio" : hasGeneric ? "Custom Gateway" : null;

        return Ok(new
        {
            emailConfigured,
            smsConfigured,
            smsProvider
        });
    }

    [HttpPost]
    public async Task<IActionResult> Send([FromBody] NotificationSendRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Message is required." });

        if (request.Channels == null || request.Channels.Count == 0)
            return BadRequest(new { message = "At least one delivery channel is required." });

        var actorId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        var actorName = User.Identity?.Name ?? "HUMANAID Officer";

        var outcomes = new List<string>();

        foreach (var channel in request.Channels)
        {
            var recipient = channel == "Email" ? request.Email : request.Phone;
            if (string.IsNullOrWhiteSpace(recipient)) continue;

            var record = new NotificationRecord
            {
                Recipient = recipient.Trim(),
                RecipientName = request.RecipientName?.Trim() ?? string.Empty,
                Channel = channel,
                Subject = request.Subject?.Trim() ?? "HUMANAID Operational Update",
                Message = request.Message.Trim(),
                Status = "Queued",
                Attempts = 0,
                CreatedByAccountId = actorId,
                CreatedByName = actorName,
                CreatedAt = DateTime.UtcNow
            };

            _db.Notifications.Add(record);
            await _db.SaveChangesAsync(ct);

            var deliveryResult = await _delivery.SendAsync(channel, recipient.Trim(), record.Subject, record.Message, ct);
            record.Attempts = 1;
            record.Status = deliveryResult.Status;
            record.LastError = deliveryResult.Error;
            record.SentAt = deliveryResult.Status == "Sent" ? DateTime.UtcNow : null;

            await _db.SaveChangesAsync(ct);
            outcomes.Add($"{channel}: {deliveryResult.Status}");
        }

        return Ok(new
        {
            message = outcomes.Count > 0 ? $"Notification queued ({string.Join(", ", outcomes)})." : "No valid recipient provided."
        });
    }

    [HttpPost("{id}/retry")]
    public async Task<IActionResult> Retry(int id, CancellationToken ct)
    {
        var record = await _db.Notifications.FindAsync(new object[] { id }, ct);
        if (record == null)
            return NotFound(new { message = "Notification not found." });

        record.Attempts += 1;
        var deliveryResult = await _delivery.SendAsync(record.Channel, record.Recipient, record.Subject, record.Message, ct);
        record.Status = deliveryResult.Status;
        record.LastError = deliveryResult.Error;
        if (deliveryResult.Status == "Sent")
            record.SentAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(record);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken ct)
    {
        var record = await _db.Notifications.FindAsync(new object[] { id }, ct);
        if (record == null)
            return NotFound(new { message = "Notification not found." });

        record.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Marked as read." });
    }
}
