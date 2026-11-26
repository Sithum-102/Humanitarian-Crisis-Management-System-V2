using HumanitarianCrisis.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace HumanitarianCrisis.API.Data;

public sealed class CrisisDbContext(DbContextOptions<CrisisDbContext> options) : DbContext(options)
{
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<EmergencyRequest> EmergencyRequests => Set<EmergencyRequest>();
    public DbSet<Operation> Operations => Set<Operation>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Shelter> Shelters => Set<Shelter>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<AuthAccount> Accounts => Set<AuthAccount>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<NotificationRecord> Notifications => Set<NotificationRecord>();
    public DbSet<RequestAssignment> RequestAssignments => Set<RequestAssignment>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<VolunteerDonation> VolunteerDonations => Set<VolunteerDonation>();
    public DbSet<VolunteerMissionAssignment> VolunteerMissionAssignments => Set<VolunteerMissionAssignment>();

    public static DateTime ToUtc(DateTime value)
        => value.Kind == DateTimeKind.Local
            ? value.ToUniversalTime()
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RequestAssignment>(entity =>
        {
            entity.HasIndex(x => x.EmergencyRequestId).IsUnique();
            entity.Property(x => x.VolunteerIdsJson).IsRequired();
        });

        modelBuilder.Entity<NotificationRecord>(entity =>
        {
            entity.HasIndex(x => new { x.RecipientAccountId, x.CreatedAt });
            entity.Property(x => x.Status).HasDefaultValue("Queued");
        });

        modelBuilder.Entity<AuthAccount>(entity =>
        {
            entity.Property(x => x.Email).HasMaxLength(254);
            entity.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => new { x.AccountId, x.CreatedAt });
            entity.HasOne<AuthAccount>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VolunteerMissionAssignment>(entity =>
        {
            entity.HasIndex(x => x.EmergencyRequestId).IsUnique();
            entity.Property(x => x.VolunteerName).HasMaxLength(150);
            entity.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("In Progress");
        });

        // Always store and return DateTime values as UTC. Without this SQLite returns them with
        // Kind=Unspecified (the browser would then treat them as local time) and PostgreSQL
        // refuses non-UTC values.
        var utc = new ValueConverter<DateTime, DateTime>(
            v => ToUtc(v),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var utcNullable = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? ToUtc(v.Value) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(utc);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(utcNullable);
            }
        }
    }
}
