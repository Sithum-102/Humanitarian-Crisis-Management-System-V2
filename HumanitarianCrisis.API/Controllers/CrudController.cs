using HumanitarianCrisis.API.Services;
using HumanitarianCrisis.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HumanitarianCrisis.API.Controllers;

/// <summary>
/// Generic CRUD base. Reads need any signed-in user; writes need Admin or Coordinator.
/// Input validation lives on the model classes (DataAnnotations / IValidatableObject).
/// </summary>
[ApiController]
[Authorize]
public abstract class CrudController<T> : ControllerBase where T : class
{
    protected readonly CrisisStore Store;

    protected CrudController(CrisisStore store) => Store = store;

    protected abstract int GetId(T item);
    protected abstract void SetId(T item, int id);

    /// <summary>Hook: stamp server-owned fields before a new record is stored.</summary>
    protected virtual void OnCreate(T item) { }

    /// <summary>Hook: keep server-owned fields from the stored record when it is replaced.</summary>
    protected virtual void OnUpdate(T item, T existing) { }

    private AuditLog CreateAudit(string action, string? oldValue = null, string? newValue = null, string? details = null)
    {
        int? actorId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        return new AuditLog
        {
            EntityType = typeof(T).Name,
            Action = action,
            ActorUserId = actorId,
            ActorName = User.Identity?.Name ?? User.FindFirstValue(ClaimTypes.Email) ?? "Authenticated user",
            ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "Unknown",
            FromValue = oldValue,
            ToValue = newValue,
            Details = details,
            OccurredAt = DateTime.UtcNow
        };
    }

    private static string? ReadStatus(T item)
        => typeof(T).GetProperty("Status")?.GetValue(item)?.ToString();

    /// <summary>Trims text and turns null into "" so optional text never hits a NOT NULL column as null.</summary>
    private static void NormalizeStrings(T item)
    {
        foreach (var property in typeof(T).GetProperties())
        {
            if (property.PropertyType != typeof(string) || !property.CanRead || !property.CanWrite)
                continue;

            property.SetValue(item, ((string?)property.GetValue(item))?.Trim() ?? "");
        }
    }

    [HttpGet]
    public ActionResult<List<T>> GetAll() => Ok(Store.All<T>());

    [HttpGet("{id:int}")]
    public ActionResult<T> GetOne(int id)
    {
        var item = Store.Find<T>(id, GetId);
        if (item is null)
            return NotFound(new { message = "Record not found." });

        return Ok(item);
    }

    [Authorize(Roles = "Admin,Coordinator")]
    [HttpPost]
    public ActionResult<T> Create([FromBody] T item)
    {
        NormalizeStrings(item);
        OnCreate(item);
        var created = Store.Add(item, SetId, CreateAudit("Created", newValue: ReadStatus(item), details: "Record created."));
        return CreatedAtAction(nameof(GetOne), new { id = GetId(created) }, created);
    }

    [Authorize(Roles = "Admin,Coordinator")]
    [HttpPut("{id:int}")]
    public IActionResult Update(int id, [FromBody] T item)
    {
        var existing = Store.Find<T>(id, GetId);
        if (existing is null)
            return NotFound(new { message = "Record not found." });

        var oldStatus = ReadStatus(existing);
        NormalizeStrings(item);
        OnUpdate(item, existing);

        var newStatus = ReadStatus(item);
        var statusChanged = !string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase);
        var action = statusChanged && typeof(T) == typeof(EmergencyRequest) && newStatus == "Approved"
            ? "RequestApproved"
            : statusChanged && typeof(T) == typeof(EmergencyRequest) && newStatus == "Rejected"
                ? "RequestRejected"
                : statusChanged ? "StatusChanged" : "Updated";
        var audit = CreateAudit(action, oldStatus, newStatus,
            statusChanged ? $"{typeof(T).Name} status changed." : $"{typeof(T).Name} updated.");

        return Store.Update(id, item, GetId, SetId, audit)
            ? NoContent()
            : NotFound(new { message = "Record not found." });
    }

    [Authorize(Roles = "Admin,Coordinator")]
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var existing = Store.Find<T>(id, GetId);
        if (existing is null)
            return NotFound(new { message = "Record not found." });

        var audit = CreateAudit("Deleted", ReadStatus(existing), null, $"{typeof(T).Name} deleted.");
        return Store.Delete<T>(id, GetId, audit)
            ? NoContent()
            : NotFound(new { message = "Record not found." });
    }
}
