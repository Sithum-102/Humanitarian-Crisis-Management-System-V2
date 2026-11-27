using Microsoft.EntityFrameworkCore;

namespace HumanitarianCrisis.API.Data;

public static class AccountSchema
{
    public static async Task EnsureAsync(CrisisDbContext db, CancellationToken cancellationToken = default)
    {
        var provider = db.Database.ProviderName ?? string.Empty;
        var sql = provider switch
        {
            "Microsoft.EntityFrameworkCore.SqlServer" => "IF COL_LENGTH('dbo.Accounts', 'Phone') IS NULL ALTER TABLE [dbo].[Accounts] ADD [Phone] nvarchar(32) NULL;",
            "Npgsql.EntityFrameworkCore.PostgreSQL" => "ALTER TABLE \"Accounts\" ADD COLUMN IF NOT EXISTS \"Phone\" varchar(32) NULL;",
            _ => null
        };

        if (!string.IsNullOrEmpty(sql))
        {
            await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
        }

        if (provider.Contains("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            var columns = await db.Database.SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Accounts')").ToListAsync(cancellationToken);
            if (!columns.Contains("Phone", StringComparer.OrdinalIgnoreCase))
            {
                await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Accounts\" ADD COLUMN \"Phone\" TEXT NULL;", cancellationToken);
            }
        }
    }
}
