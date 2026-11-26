using HumanitarianCrisis.API.Data;
using HumanitarianCrisis.API.Models;
using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Services;

/// <summary>
/// Data access for every registry, backed by EF Core (SQLite, PostgreSQL or SQL Server).
/// Registered as a scoped service: one instance (and one DbContext) per request.
/// </summary>
public sealed class CrisisStore(CrisisDbContext db)
{
    /// <summary>All rows, oldest first. Returned untracked, so changing them does not touch the database.</summary>
    public List<T> All<T>() where T : class
        => db.Set<T>().AsNoTracking().OrderBy(x => EF.Property<int>(x, "Id")).ToList();

    /// <summary>Finds one row by its integer Id (the getId delegate is kept for call-site compatibility).</summary>
    public T? Find<T>(int id, Func<T, int> getId) where T : class
        => db.Set<T>().Find(id);

    public T Add<T>(T item, Action<T, int> setId, AuditLog? audit = null) where T : class
    {
        setId(item, 0); // the database assigns the Id; never trust one sent by a client
        db.Set<T>().Add(item);

        if (audit is null)
        {
            db.SaveChanges();
            return item;
        }

        using var transaction = db.Database.BeginTransaction();
        db.SaveChanges();
        audit.EntityId = Convert.ToInt32(typeof(T).GetProperty("Id")?.GetValue(item) ?? 0);
        db.AuditLogs.Add(audit);
        db.SaveChanges();
        transaction.Commit();

        return item;
    }

    public bool Update<T>(int id, T item, Func<T, int> getId, Action<T, int> setId, AuditLog? audit = null) where T : class
    {
        var existing = db.Set<T>().Find(id);

        if (existing is null)
            return false;

        setId(item, id);
        db.Entry(existing).CurrentValues.SetValues(item);

        if (audit is null)
        {
            db.SaveChanges();
            return true;
        }

        using var transaction = db.Database.BeginTransaction();
        audit.EntityId = id;
        db.AuditLogs.Add(audit);
        db.SaveChanges();
        transaction.Commit();

        return true;
    }

    public bool Delete<T>(int id, Func<T, int> getId, AuditLog? audit = null) where T : class
    {
        var existing = db.Set<T>().Find(id);

        if (existing is null)
            return false;

        db.Set<T>().Remove(existing);

        if (audit is null)
        {
            db.SaveChanges();
            return true;
        }

        using var transaction = db.Database.BeginTransaction();
        audit.EntityId = id;
        db.AuditLogs.Add(audit);
        db.SaveChanges();
        transaction.Commit();

        return true;
    }

    public void AddAudit(AuditLog audit)
    {
        audit.OccurredAt = DateTime.UtcNow;
        db.AuditLogs.Add(audit);
        db.SaveChanges();
    }

    public List<AuditLog> GetAuditHistory(string entityType, int entityId)
        => db.AuditLogs.AsNoTracking()
            .Where(x => x.EntityType == entityType && x.EntityId == entityId)
            .OrderByDescending(x => x.OccurredAt)
            .ThenByDescending(x => x.Id)
            .ToList();

    /// <summary>Development sample data. Runs only when the database has no incidents yet.</summary>
    public void SeedDemoData()
    {
        if (db.Set<Incident>().Any())
            return;

        Add(new Incident { Title = "Flooding in Gampaha", Description = "Low-lying areas inundated after heavy rain.", Location = "Gampaha", Severity = "High", Status = "Reported", PeopleAffected = 850, ReportedAt = DateTime.UtcNow.AddHours(-30) }, (x, id) => x.Id = id);
        Add(new Incident { Title = "Landslide alert", Description = "Slope instability reported near the main road.", Location = "Kandy", Severity = "Critical", Status = "In Progress", PeopleAffected = 420, ReportedAt = DateTime.UtcNow.AddHours(-6) }, (x, id) => x.Id = id);
        Add(new Incident { Title = "Flash flood in Ratnapura", Description = "River levels rising, low-lying areas evacuating.", Location = "Ratnapura", Severity = "Critical", Status = "Responding", PeopleAffected = 1200, ReportedAt = DateTime.UtcNow.AddHours(-3) }, (x, id) => x.Id = id);
        Add(new Incident { Title = "Cyclone warning", Description = "Coastal communities advised to move inland.", Location = "Batticaloa", Severity = "High", Status = "Monitoring", PeopleAffected = 3400, ReportedAt = DateTime.UtcNow.AddHours(-12) }, (x, id) => x.Id = id);
        Add(new Incident { Title = "Drinking water contamination", Description = "Wells contaminated after flooding.", Location = "Jaffna", Severity = "Medium", Status = "Reported", PeopleAffected = 650, ReportedAt = DateTime.UtcNow.AddDays(-2) }, (x, id) => x.Id = id);

        Add(new EmergencyRequest { RequesterName = "Gampaha District Secretariat", Location = "Gampaha", Category = "Food", Description = "Dry rations for 200 families", Priority = "High", Status = "Pending" }, (x, id) => x.Id = id);
        Add(new EmergencyRequest { RequesterName = "Kandy Teaching Hospital", Location = "Kandy", Category = "Medical", Description = "Trauma kits and IV fluids", Priority = "Critical", Status = "Approved" }, (x, id) => x.Id = id);
        Add(new EmergencyRequest { RequesterName = "Jaffna Community Group", Location = "Jaffna", Category = "Water", Description = "Clean drinking water and purification tablets", Priority = "Medium", Status = "Pending" }, (x, id) => x.Id = id);

        Add(new Resource { Name = "Dry ration packs", Category = "Food", Quantity = 1800, Unit = "packs", Location = "Colombo Warehouse", Status = "Available" }, (x, id) => x.Id = id);
        Add(new Resource { Name = "Bottled water", Category = "Water", Quantity = 420, Unit = "cases", Location = "Kandy Depot", Status = "Low stock" }, (x, id) => x.Id = id);
        Add(new Resource { Name = "First-aid kits", Category = "Medical", Quantity = 260, Unit = "kits", Location = "Negombo Depot", Status = "Available" }, (x, id) => x.Id = id);
        Add(new Resource { Name = "Family tents", Category = "Shelter", Quantity = 0, Unit = "tents", Location = "Galle Depot", Status = "Out of stock" }, (x, id) => x.Id = id);

        Add(new Shelter { Name = "Gampaha Central College", Location = "Gampaha", Capacity = 400, Occupancy = 310, Status = "Open" }, (x, id) => x.Id = id);
        Add(new Shelter { Name = "Kandy Community Hall", Location = "Kandy", Capacity = 150, Occupancy = 150, Status = "Full" }, (x, id) => x.Id = id);
        Add(new Shelter { Name = "Ratnapura Temple Grounds", Location = "Ratnapura", Capacity = 300, Occupancy = 95, Status = "Open" }, (x, id) => x.Id = id);

        Add(new Volunteer { Name = "Nimali Perera", Skill = "Medical", Location = "Colombo", Phone = "+94 77 000 0001", Status = "Available" }, (x, id) => x.Id = id);
        Add(new Volunteer { Name = "Kasun Fernando", Skill = "Logistics", Location = "Negombo", Phone = "+94 77 000 0002", Status = "On assignment" }, (x, id) => x.Id = id);
        Add(new Volunteer { Name = "Ayesha Rahman", Skill = "Search & Rescue", Location = "Kandy", Phone = "+94 77 000 0003", Status = "Available" }, (x, id) => x.Id = id);
        Add(new Volunteer { Name = "Tharindu Silva", Skill = "Counselling", Location = "Galle", Phone = "+94 77 000 0004", Status = "Unavailable" }, (x, id) => x.Id = id);

        Add(new Operation { Title = "Ratnapura evacuation", Location = "Ratnapura", Team = "Rescue Team A", Status = "In Progress", StartedAt = DateTime.UtcNow.AddHours(-2) }, (x, id) => x.Id = id);
        Add(new Operation { Title = "Gampaha food distribution", Location = "Gampaha", Team = "Logistics Team B", Status = "Planned", StartedAt = DateTime.UtcNow.AddHours(4) }, (x, id) => x.Id = id);

        Add(new Organization { Name = "Sri Lanka Red Cross", Type = "NGO", Location = "Colombo", Contact = "ops@example.test", Status = "Verified" }, (x, id) => x.Id = id);
        Add(new Organization { Name = "District Health Office", Type = "Government", Location = "Kandy", Contact = "health@example.test", Status = "Active" }, (x, id) => x.Id = id);
        Add(new Organization { Name = "Community Relief Network", Type = "Community", Location = "Jaffna", Contact = "hello@example.test", Status = "Pending" }, (x, id) => x.Id = id);
    }
}
