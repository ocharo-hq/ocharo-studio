namespace OcharoStudio.Persistence.Import;

/// <summary>How an import ended: <c>imported</c> and <c>current</c> exit 0, <c>refused</c> exits 1.</summary>
public enum LegacySqliteImportStatus
{
    Imported,
    Current,
    Planned,
    Refused,
}

/// <summary>What one run of the import read, wrote and verified; it carries counts and digests, never state or keys.</summary>
public sealed record LegacySqliteImportReport
{
    public required LegacySqliteImportStatus Status { get; init; }

    /// <summary>One line on the outcome, for an operator.</summary>
    public required string Summary { get; init; }

    /// <summary>The workspace rows in the SQLite store.</summary>
    public int Workspaces { get; init; }

    /// <summary>The rows this run inserted; the rest were already in PostgreSQL, identical.</summary>
    public int WorkspacesCopied { get; init; }

    /// <summary>The rows whose member matched an Identity account and organization, so their keys are filled.</summary>
    public int WorkspacesOwned { get; init; }

    /// <summary>The saved looks across every copied workspace.</summary>
    public int Looks { get; init; }

    /// <summary>The key files in the file key ring.</summary>
    public int Keys { get; init; }

    /// <summary>The keys this run inserted.</summary>
    public int KeysCopied { get; init; }

    /// <summary>SHA-256 over every workspace row in id order (id, revision, state and materials digests), read back from
    /// PostgreSQL and equal to the SQLite side when the status is <c>imported</c>.</summary>
    public string? WorkspacesSha256 { get; init; }

    /// <summary>The rows whose PostgreSQL copy differs from SQLite; a refusal names how many.</summary>
    public int Diverged { get; init; }

    /// <summary>Where the SQLite file was moved once verified, relative to its folder.</summary>
    public string? RetiredTo { get; init; }
}
