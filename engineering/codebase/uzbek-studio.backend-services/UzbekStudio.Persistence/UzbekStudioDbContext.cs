using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using UzbekStudio.Domain.Greetings.Entities;

namespace UzbekStudio.Persistence;

/// <summary>EF Core context for the uzbekstudio store (SQLite-backed).</summary>
public sealed class UzbekStudioDbContext(DbContextOptions<UzbekStudioDbContext> options) : DbContext(options)
{
    /// <summary>Gets the served-greeting log.</summary>
    public DbSet<GreetingLog> GreetingLogs => Set<GreetingLog>();

    /// <inheritdoc />
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // SQLite cannot ORDER BY a TEXT-stored DateTimeOffset — store it as a sortable binary long instead.
        configurationBuilder.Properties<DateTimeOffset>()
            .HaveConversion<DateTimeOffsetToBinaryConverter>();
    }

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GreetingLog>(e =>
        {
            e.ToTable("greeting_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Message).IsRequired();
        });
    }
}
