using HumanitarianCrisis.API.Models;
using HumanitarianCrisis.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HumanitarianCrisis.API.Controllers;
[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public sealed class UsersController(CrisisStore store) : ControllerBase
{
    private static readonly string[] Roles = ["Admin", "Coordinator", "Volunteer", "Viewer"];
    public sealed record UserInput(string Name, string Email, string Role, string Status, string? Password);
    private static object Safe(AuthAccount a) => new { a.Id, a.Name, a.Email, a.Role, a.Status, a.CreatedAt };

    [HttpGet]
    public IActionResult All() => Ok(store.All<AuthAccount>().Select(Safe));

    [HttpPost]
    public IActionResult Create(UserInput input)
    {
        if (!Valid(input) || string.IsNullOrWhiteSpace(input.Password) || input.Password.Length < 8)
            return BadRequest(new { message = "Valid name, email, role, status and password (8+ chars) are required." });
        if (store.All<AuthAccount>().Any(a => a.Email.Equals(input.Email.Trim(), StringComparison.OrdinalIgnoreCase)))
            return Conflict(new { message = "Email already registered." });
        var account = new AuthAccount { Name = input.Name.Trim(), Email = input.Email.Trim().ToLowerInvariant(), Role = input.Role, Status = input.Status };
        account.PasswordHash = new PasswordHasher<AuthAccount>().HashPassword(account, input.Password);
        store.Add(account, (a,id) => a.Id=id);
        return Created($"/api/users/{account.Id}", Safe(account));
    }

    [HttpPut("{id:int}")]
    public IActionResult Update(int id, UserInput input)
    {
        if (!Valid(input)) return BadRequest(new { message = "Invalid user details." });
        var current = store.Find<AuthAccount>(id, a => a.Id);
        if (current is null) return NotFound();
        if (store.All<AuthAccount>().Any(a => a.Id != id && a.Email.Equals(input.Email.Trim(), StringComparison.OrdinalIgnoreCase)))
            return Conflict(new { message = "Email already registered." });
        if (current.Role == "Admin" && (input.Role != "Admin" || input.Status != "Active") && store.All<AuthAccount>().Count(a => a.Role == "Admin" && a.Status == "Active") <= 1)
            return BadRequest(new { message = "Cannot disable the last active administrator." });
        var updated = new AuthAccount { Id = id, Name = input.Name.Trim(), Email = input.Email.Trim().ToLowerInvariant(), Role = input.Role, Status = input.Status, CreatedAt = current.CreatedAt, PasswordHash = current.PasswordHash };
        if (!string.IsNullOrWhiteSpace(input.Password))
        {
            if (input.Password.Length < 8) return BadRequest(new { message = "Password must have 8+ characters." });
            updated.PasswordHash = new PasswordHasher<AuthAccount>().HashPassword(updated, input.Password);
        }
        store.Update(id, updated, a=>a.Id, (a,key)=>a.Id=key);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var account = store.Find<AuthAccount>(id, a=>a.Id);
        if (account is null) return NotFound();
        if (account.Role == "Admin" && account.Status == "Active" && store.All<AuthAccount>().Count(a => a.Role == "Admin" && a.Status == "Active") <= 1)
            return BadRequest(new { message = "Cannot delete the last active administrator." });
        return store.Delete<AuthAccount>(id,a=>a.Id) ? NoContent() : NotFound();
    }

    private static bool Valid(UserInput a) => !string.IsNullOrWhiteSpace(a.Name) && !string.IsNullOrWhiteSpace(a.Email) && a.Email.Contains('@') && Roles.Contains(a.Role) && (a.Status == "Active" || a.Status == "Inactive");
}
