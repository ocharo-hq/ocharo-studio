namespace OcharoStudio.Persistence.Import;

/// <summary>Where the retired SQLite store and its Data Protection key ring sit on the data volume.</summary>
public sealed record LegacySqliteSettings
{
    /// <summary>The configuration section the host binds.</summary>
    public const string SectionName = "LegacySqlite";

    /// <summary>The SQLite file the import reads, relative to the working directory: <c>appdata/ocharo-studio.db</c>.</summary>
    public string Path { get; init; } = "appdata/ocharo-studio.db";

    /// <summary>The folder of the file key ring the import copies: <c>appdata/keys</c>.</summary>
    public string KeysPath { get; init; } = "appdata/keys";
}
