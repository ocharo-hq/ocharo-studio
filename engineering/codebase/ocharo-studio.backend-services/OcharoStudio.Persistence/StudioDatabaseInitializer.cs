using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace OcharoStudio.Persistence;

/// <summary>Creates the additive SQLite schema required by studio state persistence.</summary>
public static class StudioDatabaseInitializer
{
    public static async Task InitializeStudioDatabaseAsync(
        this IServiceProvider services,
        CancellationToken ct = default)
    {
        var settings = services.GetRequiredService<StudioDatabaseSettings>();
        EnsureDirectory(settings.ConnectionString);

        await using var connection = new SqliteConnection(settings.ConnectionString);
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS studio_workspaces (
                workspace_id TEXT PRIMARY KEY NOT NULL,
                revision INTEGER NOT NULL CHECK (revision >= 0),
                state_json TEXT NOT NULL,
                materials_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync(ct);

        await using var columns = connection.CreateCommand();
        columns.CommandText = "SELECT name FROM pragma_table_info('studio_workspaces') WHERE name = 'materials_json';";
        if (await columns.ExecuteScalarAsync(ct) is null)
        {
            await using var migrate = connection.CreateCommand();
            migrate.CommandText =
                "ALTER TABLE studio_workspaces ADD COLUMN materials_json TEXT NOT NULL DEFAULT '{}';";
            await migrate.ExecuteNonQueryAsync(ct);
        }
    }

    private static void EnsureDirectory(string connectionString)
    {
        var path = new SqliteConnectionStringBuilder(connectionString).DataSource;
        if (string.IsNullOrWhiteSpace(path) || path == ":memory:") return;
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (directory is not null) Directory.CreateDirectory(directory);
    }
}
