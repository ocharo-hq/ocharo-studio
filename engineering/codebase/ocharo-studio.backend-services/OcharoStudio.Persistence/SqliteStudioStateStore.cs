using System.Text.Json;
using Microsoft.Data.Sqlite;
using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Foundation.Serialization;

namespace OcharoStudio.Persistence;

/// <summary>Stores isolated studio workspaces in SQLite with compare-and-update revisions.</summary>
public sealed class SqliteStudioStateStore(StudioDatabaseSettings settings) : IStudioStateStore
{
    private const string EmptyStateJson = """{"draft":null,"looks":[],"settings":{}}""";

    public async Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct)
    {
        await using var connection = new SqliteConnection(settings.ConnectionString);
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText =
            "SELECT revision, state_json, materials_json FROM studio_workspaces WHERE workspace_id = $workspace;";
        command.Parameters.AddWithValue("$workspace", workspaceId.ToString("D"));

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Empty();

        var payload = JsonSerializer.Deserialize<PersistedStudioState>(
            reader.GetString(1),
            StoredJsonConstants.Default) ?? throw new InvalidDataException("Stored studio state is empty.");
        var materials = JsonSerializer.Deserialize<JsonElement>(reader.GetString(2), StoredJsonConstants.Default);
        return new StudioState(reader.GetInt64(0), payload.Draft, payload.Looks, payload.Settings, materials);
    }

    public async Task<StudioStateWriteResult> PutAsync(
        Guid workspaceId,
        StudioState state,
        CancellationToken ct)
    {
        var payload = new PersistedStudioState(state.Draft, state.Looks, state.Settings);
        var json = JsonSerializer.Serialize(payload, StoredJsonConstants.Default);
        var suppliedMaterials = state.Materials;
        var materialsSupplied = suppliedMaterials is { ValueKind: JsonValueKind.Object };
        var materials = materialsSupplied
            ? suppliedMaterials!.Value
            : JsonSerializer.SerializeToElement(new Dictionary<string, object>(), StoredJsonConstants.Default);
        var materialsJson = JsonSerializer.Serialize(materials, StoredJsonConstants.Default);

        await using var connection = new SqliteConnection(settings.ConnectionString);
        await connection.OpenAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);

        await using (var create = connection.CreateCommand())
        {
            create.Transaction = (SqliteTransaction)transaction;
            create.CommandText =
                """
                INSERT OR IGNORE INTO studio_workspaces
                    (workspace_id, revision, state_json, materials_json, updated_at)
                VALUES ($workspace, 0, $empty, '{}', $updated);
                """;
            create.Parameters.AddWithValue("$workspace", workspaceId.ToString("D"));
            create.Parameters.AddWithValue("$empty", EmptyStateJson);
            create.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
            await create.ExecuteNonQueryAsync(ct);
        }

        long? revision;
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = (SqliteTransaction)transaction;
            update.CommandText =
                """
                UPDATE studio_workspaces
                SET revision = revision + 1,
                    state_json = $state,
                    materials_json = $materials,
                    updated_at = $updated
                WHERE workspace_id = $workspace AND revision = $expected
                    AND ($materialsSupplied = 1 OR materials_json = '{}')
                RETURNING revision;
                """;
            update.Parameters.AddWithValue("$state", json);
            update.Parameters.AddWithValue("$materials", materialsJson);
            update.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
            update.Parameters.AddWithValue("$workspace", workspaceId.ToString("D"));
            update.Parameters.AddWithValue("$expected", state.Revision);
            update.Parameters.AddWithValue("$materialsSupplied", materialsSupplied ? 1 : 0);
            revision = await update.ExecuteScalarAsync(ct) as long?;
        }

        StudioStateWriteFailure? failure = null;
        if (!revision.HasValue)
        {
            await using var current = connection.CreateCommand();
            current.Transaction = (SqliteTransaction)transaction;
            current.CommandText =
                "SELECT revision, materials_json FROM studio_workspaces WHERE workspace_id = $workspace;";
            current.Parameters.AddWithValue("$workspace", workspaceId.ToString("D"));
            await using var reader = await current.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
                failure = reader.GetInt64(0) == state.Revision &&
                    !materialsSupplied && reader.GetString(1) != "{}"
                    ? StudioStateWriteFailure.MaterialsRequired
                    : StudioStateWriteFailure.RevisionConflict;
        }

        await transaction.CommitAsync(ct);
        return revision.HasValue
            ? new StudioStateWriteResult(state with { Revision = revision.Value, Materials = materials })
            : new StudioStateWriteResult(null, failure ?? StudioStateWriteFailure.RevisionConflict);
    }

    private static StudioState Empty() => new(
        0,
        null,
        JsonSerializer.SerializeToElement(Array.Empty<object>(), StoredJsonConstants.Default),
        JsonSerializer.SerializeToElement(new Dictionary<string, object>(), StoredJsonConstants.Default),
        JsonSerializer.SerializeToElement(new Dictionary<string, object>(), StoredJsonConstants.Default));

    private sealed record PersistedStudioState(
        JsonElement? Draft,
        JsonElement Looks,
        JsonElement Settings);
}
