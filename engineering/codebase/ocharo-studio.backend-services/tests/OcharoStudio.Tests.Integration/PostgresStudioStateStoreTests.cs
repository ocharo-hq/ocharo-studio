using System.Text.Json;
using AwesomeAssertions;
using Npgsql;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using OcharoStudio.Tests.Support;
using Xunit;

namespace OcharoStudio.Tests.Integration;

/// <summary>Exercises durable, isolated optimistic state storage against a real PostgreSQL database.</summary>
public sealed class PostgresStudioStateStoreTests : IAsyncLifetime
{
    private NpgsqlDataSource dataSource = null!;

    public async Task InitializeAsync() => dataSource = NpgsqlDataSource.Create(await StudioTestDatabase.CreateAsync());

    public async Task DisposeAsync() => await dataSource.DisposeAsync();

    private PostgresStudioStateStore Store() => new(dataSource, TimeProvider.System);

    /// <summary>A workspace in a seeded Identity organization, by a subject that is no Identity account id.</summary>
    private static StudioWorkspace Owned(Guid workspace) => new(workspace, StudioTestDatabase.Organizations[0], "member-sub");

    [Fact]
    public async Task PutAsync_ShouldKeyTheWorkspaceToItsIdentityOrganizationAndAccount()
    {
        var workspace = StudioWorkspace.For(StudioTestDatabase.Organizations[2], StudioTestDatabase.Users[0].ToString("D"));

        (await Store().PutAsync(workspace, State(0, "keyed"), CancellationToken.None)).State.Should().NotBeNull();

        await using var command = dataSource.CreateCommand("SELECT organization_id, user_id FROM studio.workspaces WHERE workspace_id = $1");
        command.Parameters.AddWithValue(workspace.Id);
        await using var reader = await command.ExecuteReaderAsync();
        (await reader.ReadAsync()).Should().BeTrue();
        reader.GetGuid(0).Should().Be(StudioTestDatabase.Organizations[2]);
        reader.GetGuid(1).Should().Be(StudioTestDatabase.Users[0]);
    }

    [Fact]
    public async Task PutAsync_ShouldRefuseAnOrganizationIdentityDoesNotHold()
    {
        var act = () => Store().PutAsync(new StudioWorkspace(Guid.NewGuid(), Guid.NewGuid(), "member-sub"), State(0, "orphan"), CancellationToken.None);

        (await act.Should().ThrowAsync<PostgresException>()).Which.SqlState.Should().Be(PostgresErrorCodes.ForeignKeyViolation);
    }

    [Fact]
    public async Task DataProtectionKeys_ShouldRoundTripAndKeepTheFirstCopyOfAName()
    {
        var keys = new PostgresXmlRepository(dataSource);

        keys.StoreElement(System.Xml.Linq.XElement.Parse("<key id=\"a\"/>"), "key-a");
        keys.StoreElement(System.Xml.Linq.XElement.Parse("<key id=\"a2\"/>"), "key-a");
        keys.StoreElement(System.Xml.Linq.XElement.Parse("<key id=\"b\"/>"), "key-b");

        keys.GetAllElements().Select(element => element.Attribute("id")!.Value).Should().Equal("a", "b");
    }

    [Fact]
    public async Task PutAsync_ShouldPersistAcrossStoreInstancesAndRejectStaleRevision()
    {
        var workspace = Guid.NewGuid();
        var initial = State(0, "first");
        var saved = await Store()
            .PutAsync(Owned(workspace), initial, CancellationToken.None);

        (saved.State?.Revision).Should().Be(1);
        var reloaded = await Store()
            .GetAsync(workspace, CancellationToken.None);
        reloaded.Settings.GetProperty("theme").GetString().Should().Be("first");
        reloaded.Materials.Should().NotBeNull();
        reloaded.Materials.Value.GetProperty("catalogue-atlas-paisley-ivory-on-black").GetProperty("scale").GetDouble().Should().Be(1.5);

        var conflict = await Store()
            .PutAsync(Owned(workspace), State(0, "stale"), CancellationToken.None);
        conflict.State.Should().BeNull();
        var preserved = await Store()
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
        var store = Store();
        await store.PutAsync(Owned(firstWorkspace), State(0, "private"), CancellationToken.None);

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

        var saved = await Store()
            .PutAsync(Owned(Guid.NewGuid()), legacy, CancellationToken.None);

        (saved.State?.Materials).Should().NotBeNull();
        saved.State.Materials.Value.EnumerateObject().Should().BeEmpty();
    }

    [Fact]
    public async Task PutAsync_ShouldRejectLegacyWriteWithoutErasingExistingMaterials()
    {
        var workspace = Guid.NewGuid();
        var store = Store();
        var saved = await store.PutAsync(Owned(workspace), State(0, "current"), CancellationToken.None);
        var legacyWrite = saved.State! with
        {
            Settings = JsonSerializer.SerializeToElement(new { theme = "legacy-write" }),
            Materials = null
        };

        var rejected = await store.PutAsync(Owned(workspace), legacyWrite, CancellationToken.None);
        var preserved = await store.GetAsync(workspace, CancellationToken.None);

        rejected.State.Should().BeNull();
        rejected.Failure.Should().Be(StudioStateWriteFailure.MaterialsRequired);
        preserved.Settings.GetProperty("theme").GetString().Should().Be("current");
        preserved.Materials!.Value
                .GetProperty("catalogue-atlas-paisley-ivory-on-black")
                .GetProperty("scale")
                .GetDouble().Should().Be(1.5);
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
