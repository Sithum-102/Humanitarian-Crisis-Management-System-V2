using System.Security.Claims;
using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using HumanitarianCrisis.API.Services;

namespace HumanitarianCrisis.API.Controllers;

[ApiController]
[Route("api/volunteerdonations")]
public sealed class VolunteerDonationsController(CrisisDbContext db, NotificationDeliveryService delivery) : ControllerBase
{
    private int? AccountId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [AllowAnonymous]
    [EnableRateLimiting("volunteer-donations")]
    [HttpPost]
    public ActionResult Submit([FromBody] VolunteerDonation donation)
    {
        donation.Id = 0;
        donation.DonorName = donation.DonorName.Trim();
        donation.Phone = donation.Phone.Trim();

        if (!TryNormalizePhone(donation.Phone, out var normalizedPhone) || string.IsNullOrWhiteSpace(normalizedPhone))
            return BadRequest(new { message = "Enter a valid phone number, for example 0771234567 or +94771234567." });
        donation.Phone = normalizedPhone;

        donation.Email = string.IsNullOrWhiteSpace(donation.Email) ? null : donation.Email.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(donation.Email) && !System.Text.RegularExpressions.Regex.IsMatch(donation.Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            return BadRequest(new { message = "Enter a valid email address." });

        donation.Categories = donation.Categories.Trim();
        donation.ItemsDescription = donation.ItemsDescription.Trim();
        donation.CollectionCenter = donation.CollectionCenter.Trim();
        donation.Status = "Pending";
        donation.AssignedVolunteerId = null;
        donation.AssignedVolunteerName = null;
        donation.AcceptedAt = null;
        donation.DeliveredAt = null;
        donation.CreatedAt = DateTime.UtcNow;

        db.VolunteerDonations.Add(donation);
        db.SaveChanges();
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(VolunteerDonation), EntityId = donation.Id,
            Action = "DonationSubmitted", ActorName = donation.DonorName, ActorRole = "Volunteer",
            ToValue = donation.Status,
            Details = $"Donation pledge submitted for {donation.Categories}.", OccurredAt = DateTime.UtcNow
        });
        db.SaveChanges();

        return Created($"/api/volunteerdonations/{donation.Id}", new
        {
            donation.Id, donation.Status, donation.CreatedAt, donation.CollectionCenter,
            donation.PickupRequested
        });
    }

    // Donor contact details and pickup actions require a signed-in account. Any registered role, including Viewer, may help.
    [Authorize]
    [HttpGet("available")]
    public ActionResult<List<VolunteerDonation>> GetAvailable()
        => Ok(db.VolunteerDonations.AsNoTracking().Where(x => x.Status == "Pending")
            .OrderByDescending(x => x.PickupRequested).ThenBy(x => x.CreatedAt).ToList());

    [Authorize]
    [HttpGet("mine")]
    public ActionResult<List<VolunteerDonation>> GetMine()
    {
        if (AccountId is not int accountId) return Unauthorized();
        return Ok(db.VolunteerDonations.AsNoTracking()
            .Where(x => x.AssignedVolunteerId == accountId && x.Status == "Accepted")
            .OrderByDescending(x => x.AcceptedAt).ToList());
    }

    [Authorize]
    [HttpPost("{id:int}/accept")]
    public async Task<IActionResult> Accept(int id, [FromQuery] string? language, CancellationToken cancellationToken)
    {
        if (AccountId is not int accountId) return Unauthorized();
        var name = User.Identity?.Name ?? "Volunteer";
        var now = DateTime.UtcNow;
        var changed = db.VolunteerDonations.Where(x => x.Id == id && x.Status == "Pending")
            .ExecuteUpdate(setters => setters
                .SetProperty(x => x.Status, "Accepted")
                .SetProperty(x => x.AssignedVolunteerId, (int?)accountId)
                .SetProperty(x => x.AssignedVolunteerName, name)
                .SetProperty(x => x.AcceptedAt, (DateTime?)now));
        if (changed == 0) return Conflict(new { message = "This donation has already been accepted or is no longer available." });

        var donation = db.VolunteerDonations.Single(x => x.Id == id);
        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(VolunteerDonation), EntityId = id, Action = "DonationAccepted",
            ActorUserId = accountId, ActorName = name, ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "User",
            FromValue = "Pending", ToValue = "Accepted",
            Details = "Signed-in helper accepted the donation pickup/delivery task.", OccurredAt = now
        });
        db.SaveChanges();

        var emailStatus = "NotProvided";
        string? emailError = null;
        if (!string.IsNullOrWhiteSpace(donation.Email))
        {
            var (subject, message) = BuildAcceptanceEmail(donation, name, language);
            var result = await delivery.SendAsync("Email", donation.Email, subject, message, cancellationToken);
            emailStatus = result.Status;
            emailError = result.Error;
            db.Notifications.Add(new NotificationRecord
            {
                Recipient = donation.Email, RecipientName = donation.DonorName, Channel = "Email",
                Subject = subject, Message = message, Status = result.Status,
                Attempts = 1, LastError = result.Error, CreatedByAccountId = accountId,
                CreatedByName = name, CreatedAt = now, SentAt = result.Status == "Sent" ? DateTime.UtcNow : null
            });
            db.SaveChanges();
        }
        return Ok(new { donation, emailStatus, emailError });
    }

    [Authorize]
    [HttpPost("{id:int}/delivered")]
    public IActionResult MarkDelivered(int id)
    {
        if (AccountId is not int accountId) return Unauthorized();
        var now = DateTime.UtcNow;
        var changed = db.VolunteerDonations.Where(x => x.Id == id && x.AssignedVolunteerId == accountId && x.Status == "Accepted")
            .ExecuteUpdate(setters => setters
                .SetProperty(x => x.Status, "Delivered")
                .SetProperty(x => x.DeliveredAt, (DateTime?)now));
        if (changed == 0) return Conflict(new { message = "This delivery is not assigned to you or is already complete." });

        db.AuditLogs.Add(new AuditLog
        {
            EntityType = nameof(VolunteerDonation), EntityId = id, Action = "DonationDelivered",
            ActorUserId = accountId, ActorName = User.Identity?.Name ?? "Volunteer", ActorRole = "Volunteer",
            FromValue = "Accepted", ToValue = "Delivered",
            Details = "Signed-in helper marked the donation as delivered to the collection center.", OccurredAt = now
        });
        db.SaveChanges();
        return NoContent();
    }

    [Authorize(Roles = "Admin,Coordinator")]
    [HttpGet]
    public ActionResult<List<VolunteerDonation>> GetAll()
        => Ok(db.VolunteerDonations.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToList());

    private static (string Subject, string Message) BuildAcceptanceEmail(
        VolunteerDonation donation, string volunteerName, string? language)
    {
        var lang = language?.Trim().ToLowerInvariant();
        var id = donation.Id;
        var donor = donation.DonorName;
        var phone = donation.Phone;
        var categories = donation.Categories;
        var details = donation.ItemsDescription;
        var hub = donation.CollectionCenter;

        if (lang == "si")
        {
            var subject = donation.PickupRequested
                ? $"HUMANAID: ඔබගේ පරිත්‍යාගය ලබාගැනීම සූදානම් (#{id})"
                : $"HUMANAID: ඔබගේ පරිත්‍යාගය බෙදාහැරීමට ස්වේච්ඡා සේවකයෙකු ඉදිරිපත් වී ඇත (#{id})";
            var message = donation.PickupRequested
                ? $"ආයුබෝවන් {donor},\n\nඔබගේ පරිත්‍යාගය ලබාගැනීමේ ඉල්ලීම HUMANAID සහන සේවකයෙකු විසින් භාරගෙන ඇත (යොමු අංකය #{id}). {volunteerName} ඔබ සමඟ {phone} දුරකථන අංකයෙන් ඉක්මනින් සම්බන්ධ වී ආරක්ෂිත වේලාවක් සහ ස්ථානයක් තහවුරු කරගනු ඇත.\n\nභාණ්ඩ: {categories}\nවිස්තර: {details}\n\nඑකඟ වූ වේලාවට ලබාදීමට භාණ්ඩ සූදානම් කර තබන්න.\n\nHUMANAID සහන සම්බන්ධීකරණය"
                : $"ආයුබෝවන් {donor},\n\nHUMANAID සහන සේවකයෙකු වන {volunteerName} ඔබගේ පරිත්‍යාගය භාරගෙන ඇත (යොමු අංකය #{id}). ඔහු/ඇය භාණ්ඩ ඔබ තෝරාගත් එකතු කිරීමේ මධ්‍යස්ථානයට ගෙන යනු ඇත. භාරදීම සම්බන්ධීකරණය කිරීමට {phone} අංකයෙන් ඔබව සම්බන්ධ කරගනු ඇත.\n\nභාණ්ඩ: {categories}\nවිස්තර: {details}\nඑකතු කිරීමේ මධ්‍යස්ථානය: {hub}\n\nHUMANAID සහන සම්බන්ධීකරණය";
            return (subject, message);
        }

        if (lang == "ta")
        {
            var subject = donation.PickupRequested
                ? $"HUMANAID: உங்கள் நன்கொடையைப் பெற ஏற்பாடு செய்யப்பட்டுள்ளது (#{id})"
                : $"HUMANAID: உங்கள் நன்கொடையை வழங்க தன்னார்வலர் ஒப்புக்கொண்டுள்ளார் (#{id})";
            var message = donation.PickupRequested
                ? $"வணக்கம் {donor},\n\nஉங்கள் நன்கொடையைப் பெறுவதற்கான கோரிக்கையை HUMANAID தன்னார்வலர் ஒருவர் ஏற்றுக்கொண்டுள்ளார் (குறிப்பு எண் #{id}). {volunteerName} பாதுகாப்பான நேரத்தையும் இடத்தையும் உறுதிப்படுத்த {phone} என்ற எண்ணில் விரைவில் உங்களைத் தொடர்புகொள்வார்.\n\nபொருட்கள்: {categories}\nவிவரங்கள்: {details}\n\nஒப்புக்கொண்ட நேரத்தில் வழங்குவதற்குப் பொருட்களைத் தயாராக வைத்திருக்கவும்.\n\nHUMANAID நிவாரண ஒருங்கிணைப்பு"
                : $"வணக்கம் {donor},\n\nHUMANAID தன்னார்வலர் {volunteerName} உங்கள் நன்கொடையை ஏற்றுக்கொண்டுள்ளார் (குறிப்பு எண் #{id}). அவர் பொருட்களை நீங்கள் தேர்ந்தெடுத்த சேகரிப்பு மையத்திற்குக் கொண்டு செல்வார். ஒப்படைப்பை ஒருங்கிணைக்க {phone} என்ற எண்ணில் உங்களைத் தொடர்புகொள்வார்.\n\nபொருட்கள்: {categories}\nவிவரங்கள்: {details}\nசேகரிப்பு மையம்: {hub}\n\nHUMANAID நிவாரண ஒருங்கிணைப்பு";
            return (subject, message);
        }

        var englishSubject = donation.PickupRequested
            ? $"HUMANAID: your donation pickup is arranged (#{id})"
            : $"HUMANAID: volunteer will deliver your donation (#{id})";
        var englishMessage = donation.PickupRequested
            ? $"Hello {donor},\n\nGood news! A HUMANAID volunteer has accepted your pickup request for donation #{id}. Our volunteer, {volunteerName}, will contact you at {phone} shortly to confirm a safe pickup time and location.\n\nItems: {categories}\nDetails: {details}\n\nPlease keep the items ready for the agreed collection time.\n\nHUMANAID Relief Coordination"
            : $"Hello {donor},\n\nA HUMANAID volunteer, {volunteerName}, has accepted your donation offer (reference #{id}) and will take the items to your selected collection hub. They will contact you at {phone} to coordinate the handover.\n\nItems: {categories}\nDetails: {details}\nCollection hub: {hub}\n\nHUMANAID Relief Coordination";
        return (englishSubject, englishMessage);
    }

    private static bool TryNormalizePhone(string? input, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(input)) return true;
        var compact = new string(input.Trim().Where(c => !char.IsWhiteSpace(c) && c != '-' && c != '(' && c != ')' && c != '.').ToArray());
        if (compact.StartsWith("00", StringComparison.Ordinal)) compact = "+" + compact[2..];
        else if (compact.StartsWith('0')) compact = "+94" + compact[1..];
        else if (compact.Length == 9 && compact.All(char.IsDigit)) compact = "+94" + compact;
        else if (compact.StartsWith("94", StringComparison.Ordinal)) compact = "+" + compact;
        if (!System.Text.RegularExpressions.Regex.IsMatch(compact, @"^\+[1-9]\d{7,14}$")) return false;
        normalized = compact;
        return true;
    }
}
