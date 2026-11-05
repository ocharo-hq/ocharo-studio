using Microsoft.Data.Sqlite;

namespace OcharoStudio.Persistence;

/// <summary>Provides the configured SQLite connection string.</summary>
public sealed record StudioDatabaseSettings(string ConnectionString)
{
    /// <summary>The folder holding the SQLite file; null for an in-memory database.</summary>
    public string? DataDirectory
    {
        get
        {
            var path = new SqliteConnectionStringBuilder(ConnectionString).DataSource;
            return string.IsNullOrWhiteSpace(path) || path == ":memory:" ? null : Path.GetDirectoryName(Path.GetFullPath(path));
        }
    }
}
