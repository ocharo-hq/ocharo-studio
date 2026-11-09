using System.Text.Json;
using Npgsql;
using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Foundation.Serialization;

namespace OcharoStudio.Persistence;

/// <summary>Stores isolated studio workspaces in <c>studio.workspaces</c> with compare-and-update revisions.</summary>
public sealed class PostgresStudioStateStore(NpgsqlDataSource dataSource, TimeProvider time) : IStudioStateStore
{
    private const string EmptyStateJson = """{"draft":null,"looks":[],"settings":{}}""";

    public async Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            "SELECT revision, state_json, materials_json FROM studio.workspaces WHERE workspace_id = $1");
        command.Parameters.AddWithValue(workspaceId);

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Empty();

        var payload = JsonSerializer.Deserialize<PersistedStudioState>(reader.GetString(1), StoredJsonConstants.Default)
            ?? throw new InvalidDataException("Stored studio state is empty.");
        var materials = JsonSerializer.Deserialize<JsonElement>(reader.GetString(2), StoredJsonConstants.Default);
        return new StudioState(reader.GetInt64(0), payload.Draft, payload.Looks, payload.Settings, materials);
    }

    public async Task<StudioStateWriteResult> PutAsync(StudioWorkspace workspace, StudioState state, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new PersistedStudioState(state.Draft, state.Looks, state.Settings), StoredJsonConstants.Default);
        var materialsSupplied = state.Materials is { ValueKind: JsonValueKind.Object };
        var materials = materialsSupplied
            ? state.Materials!.Value
            : JsonSerializer.SerializeToElement(new Dictionary<string, object>(), StoredJsonConstants.Default);
        var materialsJson = JsonSerializer.Serialize(materials, StoredJsonConstants.Default);
        var userId = Guid.TryParse(workspace.UserId, out var user) ? user : (Guid?)null;
        var now = time.GetUtcNow();

        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);

        await using (var create = new NpgsqlCommand(
            """
            INSERT INTO studio.workspaces (workspace_id, organization_id, user_id, revision, state_json, materials_json, updated_at)
            VALUES ($1, $2, $3, 0, $4, '{}', $5)
            ON CONFLICT (workspace_id) DO NOTHING
            """, connection, transaction))
        {
            create.Parameters.AddWithValue(workspace.Id);
            create.Parameters.AddWithValue(workspace.OrganizationId);
            create.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
            create.Parameters.AddWithValue(EmptyStateJson);
            create.Parameters.AddWithValue(now);
            await create.ExecuteNonQueryAsync(ct);
        }

        long? revision;
        await using (var update = new NpgsqlCommand(
            """
            UPDATE studio.workspaces
            SET revision = revision + 1, state_json = $1, materials_json = $2, updated_at = $3,
                organization_id = $4, user_id = $5
            WHERE workspace_id = $6 AND revision = $7 AND ($8 OR materials_json = '{}')
            RETURNING revision
            """, connection, transaction))
        {
            update.Parameters.AddWithValue(json);
            update.Parameters.AddWithValue(materialsJson);
            update.Parameters.AddWithValue(now);
            update.Parameters.AddWithValue(workspace.OrganizationId);
            update.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
            update.Parameters.AddWithValue(workspace.Id);
            update.Parameters.AddWithValue(state.Revision);
            update.Parameters.AddWithValue(materialsSupplied);
            revision = await update.ExecuteScalarAsync(ct) as long?;
        }

        StudioStateWriteFailure? failure = null;
        if (!revision.HasValue)
        {
            await using var current = new NpgsqlCommand(
                "SELECT revision, materials_json FROM studio.workspaces WHERE workspace_id = $1", connection, transaction);
            current.Parameters.AddWithValue(workspace.Id);
            await using var reader = await current.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
                failure = reader.GetInt64(0) == state.Revision && !materialsSupplied && reader.GetString(1) != "{}"
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

    private sealed record PersistedStudioState(JsonElement? Draft, JsonElement Looks, JsonElement Settings);
}
