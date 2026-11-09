using AwesomeAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using OcharoStudio.Persistence.Import;
using OcharoStudio.Tests.Support;
using Xunit;

namespace OcharoStudio.Tests.Integration;

/// <summary>The one-time copy of the retired SQLite store: every row and key lands byte for byte, owners are recovered from
/// Identity, a rerun changes nothing, and a diverged copy keeps the SQLite file.</summary>
public sealed class LegacySqliteImportTests : IAsyncLifetime
{
    private readonly string root = Directory.CreateTempSubdirectory("ocharo-studio-import-").FullName;
    private NpgsqlDataSource dataSource = null!;

    private string DatabasePath => Path.Combine(root, "ocharo-studio.db");

    private string KeysPath => Path.Combine(root, "keys");

    public async Task InitializeAsync() => dataSource = NpgsqlDataSource.Create(await StudioTestDatabase.CreateAsync());

    public async Task DisposeAsync()
    {
        await dataSource.DisposeAsync();
        SqliteConnection.ClearAllPools();
        Directory.Delete(root, recursive: true);
    }

    [Fact]
    public async Task RunAsync_ShouldCopyVerifyAndRetire_ThenFindNothingToCopy()
    {
        var owned = StudioWorkspace.For(StudioTestDatabase.Organizations[2], StudioTestDatabase.Users[0].ToString("D"));
        var unowned = Guid.NewGuid();
        await WriteLegacyAsync(
            (owned.Id, 4, """{"draft":null,"looks":[{"id":"a"},{"id":"b"}],"settings":{"theme":"dark"}}""", """{"m":{"scale":1.5}}"""),
            (unowned, 1, """{"draft":null,"looks":[{"id":"c"}],"settings":{}}""", "{}"));
        WriteKey("key-1", "<key id=\"1\"/>");

        var report = await Import().RunAsync(dryRun: false, CancellationToken.None);

        report.Status.Should().Be(LegacySqliteImportStatus.Imported, report.Summary);
        report.Workspaces.Should().Be(2);
        report.WorkspacesCopied.Should().Be(2);
        report.WorkspacesOwned.Should().Be(1);
        report.Looks.Should().Be(3);
        report.KeysCopied.Should().Be(1);
        report.Diverged.Should().Be(0);
        File.Exists(DatabasePath).Should().BeFalse();
        File.Exists(Path.Combine(root, report.RetiredTo!)).Should().BeTrue();

        var state = await new PostgresStudioStateStore(dataSource, TimeProvider.System).GetAsync(owned.Id, CancellationToken.None);
        state.Revision.Should().Be(4);
        state.Looks.GetArrayLength().Should().Be(2);
        state.Materials!.Value.GetProperty("m").GetProperty("scale").GetDouble().Should().Be(1.5);
        (await ScalarAsync<Guid>("SELECT organization_id FROM studio.workspaces WHERE workspace_id = $1", owned.Id)).Should().Be(StudioTestDatabase.Organizations[2]);
        (await ScalarAsync<object>("SELECT user_id FROM studio.workspaces WHERE workspace_id = $1", unowned)).Should().Be(DBNull.Value);
        new PostgresXmlRepository(dataSource).GetAllElements().Should().ContainSingle();

        (await Import().RunAsync(dryRun: false, CancellationToken.None)).Status.Should().Be(LegacySqliteImportStatus.Current);
    }

    [Fact]
    public async Task RunAsync_ShouldRetireAfterARerun_WhenTheRowsAreAlreadyIdentical()
    {
        var workspace = Guid.NewGuid();
        await WriteLegacyAsync((workspace, 2, """{"draft":null,"looks":[],"settings":{}}""", "{}"));
        await InsertAsync(workspace, 2, """{"draft":null,"looks":[],"settings":{}}""", "{}");

        var report = await Import().RunAsync(dryRun: false, CancellationToken.None);

        report.Status.Should().Be(LegacySqliteImportStatus.Imported, report.Summary);
        report.WorkspacesCopied.Should().Be(0);
        File.Exists(DatabasePath).Should().BeFalse();
    }

    [Fact]
    public async Task RunAsync_ShouldRefuseAndKeepTheFile_WhenPostgreSqlHoldsANewerCopy()
    {
        var workspace = Guid.NewGuid();
        await WriteLegacyAsync((workspace, 2, """{"draft":null,"looks":[],"settings":{}}""", "{}"));
        await InsertAsync(workspace, 3, """{"draft":null,"looks":[{"id":"new"}],"settings":{}}""", "{}");

        var report = await Import().RunAsync(dryRun: false, CancellationToken.None);

        report.Status.Should().Be(LegacySqliteImportStatus.Refused);
        report.Diverged.Should().Be(1);
        File.Exists(DatabasePath).Should().BeTrue();
    }

    [Fact]
    public async Task RunAsync_ShouldWriteNothing_OnADryRun()
    {
        await WriteLegacyAsync((Guid.NewGuid(), 1, """{"draft":null,"looks":[],"settings":{}}""", "{}"));

        var report = await Import().RunAsync(dryRun: true, CancellationToken.None);

        report.Status.Should().Be(LegacySqliteImportStatus.Planned);
        report.WorkspacesCopied.Should().Be(1);
        (await ScalarAsync<long>("SELECT count(*) FROM studio.workspaces")).Should().Be(0);
        File.Exists(DatabasePath).Should().BeTrue();
    }

    [Fact]
    public async Task RunAsync_ShouldFindNothingToCopy_WithoutASqliteStore()
    {
        var report = await Import().RunAsync(dryRun: false, CancellationToken.None);

        report.Status.Should().Be(LegacySqliteImportStatus.Current);
    }

    private LegacySqliteImport Import() =>
        new(dataSource, new LegacySqliteSettings { Path = DatabasePath, KeysPath = KeysPath }, TimeProvider.System, NullLogger<LegacySqliteImport>.Instance);

    /// <summary>Writes the retired store's schema as its last release left it, with these rows.</summary>
    private async Task WriteLegacyAsync(params (Guid Id, long Revision, string State, string Materials)[] rows)
    {
        await using var connection = new SqliteConnection($"Data Source={DatabasePath};Pooling=False");
        await connection.OpenAsync();
        await using (var create = connection.CreateCommand())
        {
            create.CommandText =
                """
                PRAGMA journal_mode = WAL;
                CREATE TABLE studio_workspaces (
                    workspace_id TEXT PRIMARY KEY NOT NULL,
                    revision INTEGER NOT NULL CHECK (revision >= 0),
                    state_json TEXT NOT NULL,
                    materials_json TEXT NOT NULL DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );
                """;
            await create.ExecuteNonQueryAsync();
        }

        foreach (var row in rows)
        {
            await using var insert = connection.CreateCommand();
            insert.CommandText = "INSERT INTO studio_workspaces VALUES ($id, $revision, $state, $materials, $updated)";
            insert.Parameters.AddWithValue("$id", row.Id.ToString("D"));
            insert.Parameters.AddWithValue("$revision", row.Revision);
            insert.Parameters.AddWithValue("$state", row.State);
            insert.Parameters.AddWithValue("$materials", row.Materials);
            insert.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
            await insert.ExecuteNonQueryAsync();
        }
    }

    private void WriteKey(string name, string xml)
    {
        Directory.CreateDirectory(KeysPath);
        File.WriteAllText(Path.Combine(KeysPath, name + ".xml"), xml);
    }

    private async Task InsertAsync(Guid workspace, long revision, string state, string materials)
    {
        await using var command = dataSource.CreateCommand(
            "INSERT INTO studio.workspaces (workspace_id, revision, state_json, materials_json, updated_at) VALUES ($1, $2, $3, $4, now())");
        command.Parameters.AddWithValue(workspace);
        command.Parameters.AddWithValue(revision);
        command.Parameters.AddWithValue(state);
        command.Parameters.AddWithValue(materials);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<T> ScalarAsync<T>(string sql, params object[] parameters)
    {
        await using var command = dataSource.CreateCommand(sql);
        foreach (var parameter in parameters)
            command.Parameters.AddWithValue(parameter);
        return (T)(await command.ExecuteScalarAsync())!;
    }
}
