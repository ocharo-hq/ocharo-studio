using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace OcharoStudio.Api.Studio.Health;

/// <summary>Reports Studio ready once the product database answers and the <c>studio</c> set's tables exist.</summary>
public sealed class StudioDatabaseReadinessCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var command = dataSource.CreateCommand("SELECT 1 FROM studio.workspaces LIMIT 0");
            await command.ExecuteNonQueryAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (NpgsqlException failure)
        {
            return HealthCheckResult.Unhealthy("The product database or the studio schema is unavailable.", failure);
        }
    }
}
