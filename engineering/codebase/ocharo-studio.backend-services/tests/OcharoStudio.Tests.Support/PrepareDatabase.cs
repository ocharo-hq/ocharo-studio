using Npgsql;

namespace OcharoStudio.Tests.Support;

/// <summary>Prepares a database for a host run outside the test tiers, such as the CI browser suite's API: creates it when
/// missing, then applies Identity's stand-in set, Studio's sets and the seeded accounts.</summary>
public static class PrepareDatabase
{
    /// <summary>Usage: <c>OcharoStudio.Tests.Support &lt;connection string&gt;</c>.</summary>
    public static async Task<int> Main(string[] args)
    {
        if (args is not [var connectionString])
        {
            await Console.Error.WriteLineAsync("Usage: OcharoStudio.Tests.Support <connection string>");
            return 1;
        }

        var target = new NpgsqlConnectionStringBuilder(connectionString);
        var admin = new NpgsqlConnectionStringBuilder(connectionString) { Database = "postgres", Pooling = false };
        await using (var connection = new NpgsqlConnection(admin.ConnectionString))
        {
            await connection.OpenAsync();
            await using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = $1", connection);
            exists.Parameters.AddWithValue(target.Database!);
            if (await exists.ExecuteScalarAsync() is null)
            {
                await using var create = new NpgsqlCommand($"CREATE DATABASE \"{target.Database}\"", connection);
                await create.ExecuteNonQueryAsync();
            }
        }

        await StudioTestDatabase.PrepareAsync(connectionString);
        Console.WriteLine($"Prepared {target.Database} as {StudioTestDatabase.OwnerInstance}.");
        return 0;
    }
}
