using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.Integration;

/// <summary>Exercises durable, isolated optimistic state storage against a real SQLite file.</summary>
public sealed class SqliteStudioStateStoreTests : IAsyncLifetime
{
    private readonly string path = Path.Combine(
        Path.GetTempPath(),
        $"ocharo-studio-{Guid.NewGuid():N}.db");
    private ServiceProvider services = null!;
    private StudioDatabaseSettings settings = null!;

    public async Task InitializeAsync()
    {
        settings = new StudioDatabaseSettings($"Data Source={path};Pooling=False");
        services = new ServiceCollection().AddSingleton(settings).BuildServiceProvider();
        await services.InitializeStudioDatabaseAsync();
    }

    public Task DisposeAsync()
    {
        services.Dispose();
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    [Fact]
    public async Task PutAsync_ShouldPersistAcrossStoreInstancesAndRejectStaleRevision()
    {
        var workspace = Guid.NewGuid();
        var initial = State(0, "first");
        var saved = await new SqliteStudioStateStore(settings)
            .PutAsync(workspace, initial, CancellationToken.None);

        (saved.State?.Revision).Should().Be(1);
        var reloaded = await new SqliteStudioStateStore(settings)
            .GetAsync(workspace, CancellationToken.None);
        reloaded.Settings.GetProperty("theme").GetString().Should().Be("first");
        reloaded.Materials.Should().NotBeNull();
        reloaded.Materials.Value.GetProperty("catalogue-atlas-paisley-ivory-on-black").GetProperty("scale").GetDouble().Should().Be(1.5);

        var conflict = await new SqliteStudioStateStore(settings)
            .PutAsync(workspace, State(0, "stale"), CancellationToken.None);
        conflict.State.Should().BeNull();
        var preserved = await new SqliteStudioStateStore(settings)
            .GetAsync(workspace, CancellationToken.None);
        preserved.Revision.Should().Be(1);
        preserved.Settings.GetProperty("theme").GetString().Should().Be("first");
        preserved.Materials.Should().NotBeNull();
        preserved.Materials.Value.GetProperty("catalogue-atlas-paisley-ivory-on-black").GetProperty("revision").GetInt64().Should().Be(1);
    }

    [Fact]
    public async Task GetAsync_ShouldNotLeakStateAcrossWorkspaces()
    {
        var firstWorkspace = Guid.NewGuid();
        var secondWorkspace = Guid.NewGuid();
        var store = new SqliteStudioStateStore(settings);
        await store.PutAsync(firstWorkspace, State(0, "private"), CancellationToken.None);

        var isolated = await store.GetAsync(secondWorkspace, CancellationToken.None);

        isolated.Revision.Should().Be(0);
        (isolated.Draft?.ValueKind ?? JsonValueKind.Null).Should().Be(JsonValueKind.Null);
        isolated.Looks.EnumerateArray().Should().BeEmpty();
        isolated.Settings.EnumerateObject().Should().BeEmpty();
        isolated.Materials.Should().NotBeNull();
        isolated.Materials.Value.EnumerateObject().Should().BeEmpty();
    }

    [Fact]
    public async Task PutAsync_ShouldNormalizeMissingLegacyMaterialsToEmptyObject()
    {
        var legacy = State(0, "legacy") with { Materials = null };

        var saved = await new SqliteStudioStateStore(settings)
            .PutAsync(Guid.NewGuid(), legacy, CancellationToken.None);

        (saved.State?.Materials).Should().NotBeNull();
        saved.State.Materials.Value.EnumerateObject().Should().BeEmpty();
    }

    [Fact]
    public async Task PutAsync_ShouldRejectLegacyWriteWithoutErasingExistingMaterials()
    {
        var workspace = Guid.NewGuid();
        var store = new SqliteStudioStateStore(settings);
        var saved = await store.PutAsync(workspace, State(0, "current"), CancellationToken.None);
        var legacyWrite = saved.State! with
        {
            Settings = JsonSerializer.SerializeToElement(new { theme = "legacy-write" }),
            Materials = null
        };

        var rejected = await store.PutAsync(workspace, legacyWrite, CancellationToken.None);
        var preserved = await store.GetAsync(workspace, CancellationToken.None);

        rejected.State.Should().BeNull();
        rejected.Failure.Should().Be(StudioStateWriteFailure.MaterialsRequired);
        preserved.Settings.GetProperty("theme").GetString().Should().Be("current");
        preserved.Materials!.Value
                .GetProperty("catalogue-atlas-paisley-ivory-on-black")
                .GetProperty("scale")
                .GetDouble().Should().Be(1.5);
    }

    [Fact]
    public async Task InitializeStudioDatabaseAsync_ShouldAddMaterialsWithoutChangingExistingRows()
    {
        await services.DisposeAsync();
        if (File.Exists(path)) File.Delete(path);
        await using (var connection = new SqliteConnection(settings.ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                CREATE TABLE studio_workspaces (
                    workspace_id TEXT PRIMARY KEY NOT NULL,
                    revision INTEGER NOT NULL,
                    state_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                INSERT INTO studio_workspaces (workspace_id, revision, state_json, updated_at)
                VALUES ('0c645d1c-576a-43b8-a8d2-b75eb892014d', 7,
                    '{"draft":null,"looks":[],"settings":{"theme":"legacy"}}',
                    '2026-09-25T00:00:00.000Z');
                """;
            await command.ExecuteNonQueryAsync();
        }
        services = new ServiceCollection().AddSingleton(settings).BuildServiceProvider();

        await services.InitializeStudioDatabaseAsync();
        var state = await new SqliteStudioStateStore(settings).GetAsync(
            Guid.Parse("0c645d1c-576a-43b8-a8d2-b75eb892014d"),
            CancellationToken.None);

        state.Revision.Should().Be(7);
        state.Settings.GetProperty("theme").GetString().Should().Be("legacy");
        state.Materials.Should().NotBeNull();
        state.Materials.Value.EnumerateObject().Should().BeEmpty();
    }

    private static StudioState State(long revision, string theme) => new(
        revision,
        JsonSerializer.SerializeToElement(new
        {
            schemaVersion = 2,
            assetVersion = 1,
            id = "0c645d1c-576a-43b8-a8d2-b75eb892014d",
            name = "Draft",
            garmentId = "nimcha",
            createdAt = "2026-09-25T00:00:00Z",
            updatedAt = "2026-09-25T00:00:00Z",
            parts = new
            {
                body = new
                {
                    materialId = "adras",
                    placement = new
                    {
                        rotation = 0,
                        offsetX = 0,
                        offsetY = 0,
                        scale = 1,
                        materialAnchorX = .5,
                        materialAnchorY = .5,
                        garmentAnchorX = .5,
                        garmentAnchorY = .5
                    }
                }
            }
        }),
        JsonSerializer.SerializeToElement(Array.Empty<object>()),
        JsonSerializer.SerializeToElement(new { theme }),
        JsonSerializer.SerializeToElement(new Dictionary<string, object>
        {
            ["catalogue-atlas-paisley-ivory-on-black"] = new
            {
                scale = 1.5,
                revision = 1,
                updatedAt = "2026-09-25T00:00:00.000Z"
            }
        }));
}
