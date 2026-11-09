using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;
using Microsoft.Data.Sqlite;
using OcharoStudio.Api.Studio.Import;
using OcharoStudio.Application.Studio.State;
using Xunit;
using static OcharoStudio.Tests.E2E.StudioTestIdentity;

namespace OcharoStudio.Tests.E2E;

/// <summary>While the retired SQLite store waits on the volume, state routes answer 503; <c>import-sqlite</c> copies it
/// over the host's own services, and the member then reads their saved looks from PostgreSQL.</summary>
public sealed class LegacySqliteImportVerbTests : IDisposable
{
    private readonly string root = Directory.CreateTempSubdirectory("ocharo-studio-legacy-").FullName;

    private string DatabasePath => Path.Combine(root, "ocharo-studio.db");

    [Fact]
    public async Task StateRoutes_ShouldAnswer503_UntilTheImportRetiresTheSqliteStore()
    {
        var workspace = StudioWorkspace.IdFor(Editor.OrganizationId!.Value, Editor.Subject);
        WriteLegacy(workspace, """{"draft":null,"looks":[{"id":"a"},{"id":"b"}],"settings":{}}""");
        await using var host = StudioHost.Create(new Dictionary<string, string?>
        {
            ["LegacySqlite:Path"] = DatabasePath,
            ["LegacySqlite:KeysPath"] = Path.Combine(root, "keys"),
        });
        using var editor = await SignedIn(host.Factory, Editor);

        (await editor.GetAsync("/api/studio/state")).StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);

        using var output = new StringWriter();
        var exit = await LegacySqliteImportVerb.RunAsync(host.Factory.Services, [], output, TextWriter.Null, CancellationToken.None);

        exit.Should().Be(0);
        var result = output.ToString().TrimEnd().Split('\n')[^1];
        result.Should().StartWith("import-result ");
        var report = JsonDocument.Parse(result["import-result ".Length..]).RootElement;
        report.GetProperty("status").GetString().Should().Be("imported");
        report.GetProperty("looks").GetInt32().Should().Be(2);
        var state = await editor.GetFromJsonAsync<JsonElement>("/api/studio/state");
        state.GetProperty("revision").GetInt64().Should().Be(3);
        state.GetProperty("looks").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Verb_ShouldRefuseAnUnknownArgument()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?> { ["LegacySqlite:Path"] = DatabasePath });
        using var output = new StringWriter();

        (await LegacySqliteImportVerb.RunAsync(host.Factory.Services, ["--force"], output, TextWriter.Null, CancellationToken.None)).Should().Be(1);
        output.ToString().Should().Contain("\"status\":\"refused\"");
    }

    private void WriteLegacy(Guid workspace, string state)
    {
        using var connection = new SqliteConnection($"Data Source={DatabasePath};Pooling=False");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE studio_workspaces (workspace_id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL,
                state_json TEXT NOT NULL, materials_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
            INSERT INTO studio_workspaces VALUES ($id, 3, $state, '{}', '2026-11-01T00:00:00.0000000+00:00');
            """;
        command.Parameters.AddWithValue("$id", workspace.ToString("D"));
        command.Parameters.AddWithValue("$state", state);
        command.ExecuteNonQuery();
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(root, recursive: true);
    }
}
