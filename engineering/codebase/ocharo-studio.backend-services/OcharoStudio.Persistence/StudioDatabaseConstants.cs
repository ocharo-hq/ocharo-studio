namespace OcharoStudio.Persistence;

/// <summary>Names Studio's place in the product database: its migration set, its schemas and the dependency it keys into.</summary>
public static class StudioDatabaseConstants
{
    /// <summary>The settings key of the product database's connection string, filled per target by Wheelhouse.</summary>
    public const string ConnectionStringName = "Database";

    /// <summary>Studio's migration set, its history, lock and owner marker.</summary>
    public const string MigrationSetName = "studio";

    /// <summary>The schema Studio's set owns in the shared product database.</summary>
    public const string Schema = "studio";

    /// <summary>The schema of Studio's BFF session cache, apart from Desk's <c>cache</c>: a cache set claims its schema.</summary>
    public const string CacheSchema = "studio_cache";

    /// <summary>The resource prefix of the set's embedded <c>NNN-name/</c> folders.</summary>
    public const string MigrationResourcePrefix = "OcharoStudio/Migrations/";

    /// <summary>The Identity set whose accounts and organizations the workspaces key into, and the level that publishes them.</summary>
    public const string IdentitySetName = "identity";

    /// <inheritdoc cref="IdentitySetName"/>
    public const int IdentityLevel = 1;

    /// <summary>The advisory lock of Studio's set, apart from every other set in the product database.</summary>
    public const long AdvisoryLockId = 8_260_001;
}
