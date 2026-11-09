using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;
using Npgsql;
using OcharoStudio.Application.Studio.State;

namespace OcharoStudio.Persistence.Import;

/// <summary>Copies the retired SQLite store and its file key ring into the <c>studio</c> schema once, verifies the copy row
/// by row, then retires the SQLite file so the copy never runs again.</summary>
/// <remarks>
///   - idempotent: a row or key already in PostgreSQL is kept; a rerun after a failed retire finds every row identical
///     and only retires the file
///   - a row whose PostgreSQL copy differs (revision or content) refuses the run and keeps the file, so nothing is lost
///   - each workspace's Identity organization and account are recovered by matching its derived id against every
///     published account and organization pair; a workspace that matches none keeps both keys empty
///   - the same code serves dev and prod; the report carries counts and digests only, never state, keys or ids
/// </remarks>
public sealed partial class LegacySqliteImport(
    NpgsqlDataSource dataSource, LegacySqliteSettings settings, TimeProvider time, ILogger<LegacySqliteImport> logger)
{
    /// <summary>Copies, verifies and retires; with <paramref name="dryRun"/> it reads both sides and writes nothing.</summary>
    public async Task<LegacySqliteImportReport> RunAsync(bool dryRun, CancellationToken ct)
    {
        var path = Path.GetFullPath(settings.Path);
        if (!File.Exists(path))
            return new LegacySqliteImportReport { Status = LegacySqliteImportStatus.Current, Summary = "No SQLite store to copy." };

        var rows = await ReadWorkspacesAsync(path, ct);
        var keys = ReadKeys(Path.GetFullPath(settings.KeysPath));
        var owners = await ReadOwnersAsync(ct);

        if (dryRun)
        {
            var present = await ReadPresentAsync(rows, ct);
            return Report(LegacySqliteImportStatus.Planned, "Dry run: nothing written.", rows, keys, owners,
                copied: rows.Count(row => !present.ContainsKey(row.Id)), keysCopied: 0, present);
        }

        int copied, keysCopied;
        await using (var connection = await dataSource.OpenConnectionAsync(ct))
        await using (var transaction = await connection.BeginTransactionAsync(ct))
        {
            copied = await InsertWorkspacesAsync(connection, transaction, rows, owners, ct);
            keysCopied = await InsertKeysAsync(connection, transaction, keys, ct);
            await transaction.CommitAsync(ct);
        }

        var stored = await ReadPresentAsync(rows, ct);
        var report = Report(LegacySqliteImportStatus.Imported, "", rows, keys, owners, copied, keysCopied, stored);
        var missingKeys = await CountMissingKeysAsync(keys, ct);
        if (report.Diverged > 0 || missingKeys > 0)
        {
            LogRefused(logger, report.Diverged, missingKeys);
            return report with
            {
                Status = LegacySqliteImportStatus.Refused,
                Summary = $"{report.Diverged} workspaces differ and {missingKeys} keys are missing in PostgreSQL; the SQLite store stays in place.",
            };
        }

        var retiredTo = Retire(path);
        LogImported(logger, rows.Count, copied, keys.Count, keysCopied);
        return report with
        {
            Summary = $"Copied {copied} of {rows.Count} workspaces and {keysCopied} of {keys.Count} keys; every row verified.",
            RetiredTo = retiredTo,
        };
    }

    private static async Task<IReadOnlyList<LegacyWorkspace>> ReadWorkspacesAsync(string path, CancellationToken ct)
    {
        var builder = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite, Pooling = false };
        await using var connection = new SqliteConnection(builder.ConnectionString);
        await connection.OpenAsync(ct);
        await using var exists = connection.CreateCommand();
        exists.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'studio_workspaces'";
        if (await exists.ExecuteScalarAsync(ct) is null) return [];

        // One read transaction, so a writer still running beside the import cannot tear the snapshot.
        await using var transaction = connection.BeginTransaction(deferred: true);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT workspace_id, revision, state_json, materials_json, updated_at FROM studio_workspaces ORDER BY workspace_id";
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<LegacyWorkspace>();
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new LegacyWorkspace(
                Guid.ParseExact(reader.GetString(0), "D"),
                reader.GetInt64(1),
                reader.GetString(2),
                reader.GetString(3),
                DateTimeOffset.Parse(reader.GetString(4), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind)));
        }

        return rows;
    }

    private static IReadOnlyList<LegacyKey> ReadKeys(string folder) =>
        Directory.Exists(folder)
            ? Directory.GetFiles(folder, "*.xml")
                .Order(StringComparer.Ordinal)
                .Select(file => new LegacyKey(Path.GetFileNameWithoutExtension(file), File.ReadAllText(file)))
                .ToList()
            : [];

    /// <summary>Maps every derived workspace id to its Identity organization and account, over the published tables.</summary>
    private async Task<IReadOnlyDictionary<Guid, (Guid Organization, Guid User)>> ReadOwnersAsync(CancellationToken ct)
    {
        var users = await ReadIdsAsync("SELECT id FROM identity.identity_users", ct);
        var organizations = await ReadIdsAsync("SELECT id FROM identity.identity_organizations", ct);
        var owners = new Dictionary<Guid, (Guid, Guid)>();
        foreach (var organization in organizations)
            foreach (var user in users)
                owners[StudioWorkspace.IdFor(organization, user.ToString("D"))] = (organization, user);
        return owners;
    }

    private async Task<List<Guid>> ReadIdsAsync(string sql, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(sql);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var ids = new List<Guid>();
        while (await reader.ReadAsync(ct))
            ids.Add(reader.GetGuid(0));
        return ids;
    }

    private async Task<int> InsertWorkspacesAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, IReadOnlyList<LegacyWorkspace> rows,
        IReadOnlyDictionary<Guid, (Guid Organization, Guid User)> owners, CancellationToken ct)
    {
        var copied = 0;
        foreach (var row in rows)
        {
            await using var insert = new NpgsqlCommand(
                """
                INSERT INTO studio.workspaces (workspace_id, organization_id, user_id, revision, state_json, materials_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (workspace_id) DO NOTHING
                """, connection, transaction);
            var owned = owners.TryGetValue(row.Id, out var owner);
            insert.Parameters.AddWithValue(row.Id);
            insert.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Uuid, owned ? owner.Organization : (object)DBNull.Value);
            insert.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Uuid, owned ? owner.User : (object)DBNull.Value);
            insert.Parameters.AddWithValue(row.Revision);
            insert.Parameters.AddWithValue(row.StateJson);
            insert.Parameters.AddWithValue(row.MaterialsJson);
            insert.Parameters.AddWithValue(row.UpdatedAt.ToUniversalTime());
            copied += await insert.ExecuteNonQueryAsync(ct);
        }

        return copied;
    }

    private static async Task<int> InsertKeysAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, IReadOnlyList<LegacyKey> keys, CancellationToken ct)
    {
        var copied = 0;
        foreach (var key in keys)
        {
            await using var insert = new NpgsqlCommand(
                "INSERT INTO studio.data_protection_keys (friendly_name, xml) VALUES ($1, $2) ON CONFLICT (friendly_name) DO NOTHING",
                connection, transaction);
            insert.Parameters.AddWithValue(key.FriendlyName);
            insert.Parameters.AddWithValue(key.Xml);
            copied += await insert.ExecuteNonQueryAsync(ct);
        }

        return copied;
    }

    /// <summary>Reads back each legacy row's PostgreSQL copy by id: its revision and content digest.</summary>
    private async Task<IReadOnlyDictionary<Guid, string>> ReadPresentAsync(IReadOnlyList<LegacyWorkspace> rows, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            "SELECT workspace_id, revision, state_json, materials_json FROM studio.workspaces WHERE workspace_id = ANY($1)");
        command.Parameters.AddWithValue(rows.Select(row => row.Id).ToArray());
        await using var reader = await command.ExecuteReaderAsync(ct);
        var present = new Dictionary<Guid, string>();
        while (await reader.ReadAsync(ct))
            present[reader.GetGuid(0)] = Digest(reader.GetGuid(0), reader.GetInt64(1), reader.GetString(2), reader.GetString(3));
        return present;
    }

    private async Task<int> CountMissingKeysAsync(IReadOnlyList<LegacyKey> keys, CancellationToken ct)
    {
        if (keys.Count == 0) return 0;
        await using var command = dataSource.CreateCommand(
            "SELECT friendly_name, xml FROM studio.data_protection_keys WHERE friendly_name = ANY($1)");
        command.Parameters.AddWithValue(keys.Select(key => key.FriendlyName).ToArray());
        await using var reader = await command.ExecuteReaderAsync(ct);
        var stored = new Dictionary<string, string>(StringComparer.Ordinal);
        while (await reader.ReadAsync(ct))
            stored[reader.GetString(0)] = reader.GetString(1);
        return keys.Count(key => !stored.TryGetValue(key.FriendlyName, out var xml) || xml != key.Xml);
    }

    private static LegacySqliteImportReport Report(
        LegacySqliteImportStatus status, string summary, IReadOnlyList<LegacyWorkspace> rows, IReadOnlyList<LegacyKey> keys,
        IReadOnlyDictionary<Guid, (Guid, Guid)> owners, int copied, int keysCopied, IReadOnlyDictionary<Guid, string> stored)
    {
        var digests = rows.Select(row => (row.Id, Digest: Digest(row.Id, row.Revision, row.StateJson, row.MaterialsJson))).ToList();
        var diverged = status == LegacySqliteImportStatus.Planned
            ? digests.Count(row => stored.TryGetValue(row.Id, out var digest) && digest != row.Digest)
            : digests.Count(row => !stored.TryGetValue(row.Id, out var digest) || digest != row.Digest);
        return new LegacySqliteImportReport
        {
            Status = status,
            Summary = summary,
            Workspaces = rows.Count,
            WorkspacesCopied = copied,
            WorkspacesOwned = rows.Count(row => owners.ContainsKey(row.Id)),
            Looks = rows.Sum(row => CountLooks(row.StateJson)),
            Keys = keys.Count,
            KeysCopied = keysCopied,
            WorkspacesSha256 = Sha256(string.Join('\n', digests.OrderBy(row => row.Id).Select(row => row.Digest))),
            Diverged = diverged,
        };
    }

    private static string Digest(Guid id, long revision, string state, string materials) =>
        $"{id:D}:{revision}:{Sha256(state)}:{Sha256(materials)}";

    private static string Sha256(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

    private static int CountLooks(string stateJson)
    {
        using var document = JsonDocument.Parse(stateJson);
        return document.RootElement.TryGetProperty("looks", out var looks) && looks.ValueKind == JsonValueKind.Array
            ? looks.GetArrayLength()
            : 0;
    }

    /// <summary>Moves the SQLite file and its journal files aside under one stamped name; the key folder stays for evidence.</summary>
    private string Retire(string path)
    {
        var stamp = time.GetUtcNow().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var retired = $"{path}.imported-{stamp}";
        foreach (var suffix in new[] { "-wal", "-shm" })
        {
            if (File.Exists(path + suffix))
                File.Move(path + suffix, retired + suffix);
        }

        File.Move(path, retired);
        return Path.GetFileName(retired);
    }

    [LoggerMessage(EventId = 8261, Level = LogLevel.Information, Message = "Imported the SQLite store: {Copied} of {Workspaces} workspaces and {KeysCopied} of {Keys} keys copied, every row verified")]
    private static partial void LogImported(ILogger logger, int workspaces, int copied, int keys, int keysCopied);

    [LoggerMessage(EventId = 8262, Level = LogLevel.Warning, Message = "Refused to retire the SQLite store: {Diverged} workspaces differ and {MissingKeys} keys are missing in PostgreSQL")]
    private static partial void LogRefused(ILogger logger, int diverged, int missingKeys);

    private sealed record LegacyWorkspace(Guid Id, long Revision, string StateJson, string MaterialsJson, DateTimeOffset UpdatedAt);

    private sealed record LegacyKey(string FriendlyName, string Xml);
}
