using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace UzbekStudio.Persistence;

/// <summary>Registers the persistence layer — the EF Core SQLite context.</summary>
public static class DependencyInjection
{
    /// <summary>Adds <see cref="UzbekStudioDbContext"/> backed by SQLite (connection string <c>ConnectionStrings:UzbekStudio</c>).</summary>
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["ConnectionStrings:UzbekStudio"] ?? "Data Source=uzbekstudio.db";

        services.AddDbContext<UzbekStudioDbContext>(options => options.UseSqlite(connectionString));

        return services;
    }

    /// <summary>Creates the SQLite schema on boot (no migrations in this uzbekstudio — the model is applied directly).</summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UzbekStudioDbContext>();
        await db.Database.EnsureCreatedAsync();
    }
}
