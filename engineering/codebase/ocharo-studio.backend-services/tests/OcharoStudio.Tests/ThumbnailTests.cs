using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OcharoStudio.Application.Studio.State;
using Xunit;
using static OcharoStudio.Tests.StudioTestIdentity;

namespace OcharoStudio.Tests;

/// <summary>Saved-look thumbnails on WoW2 Files (<c>Files:BaseUrl</c> set): a save stores each new thumbnail once and keeps its
/// route in the state, a stored data URL stays until its look is saved again with a new one, the route links to Files for the
/// workspace's member, and without <c>Files:BaseUrl</c> nothing changes. Files itself is <see cref="TestFiles"/>.</summary>
public sealed class ThumbnailTests
{
    private const string State = "/api/studio/state";

    [Fact]
    public async Task Save_ShouldUploadANewThumbnailOnceAndKeepItsRoute()
    {
        var files = new TestFiles();
        await using var host = Host(files);
        using var editor = await SignedIn(host.Factory, Editor);
        var thumbnail = DataUrl("a");

        var saved = await PutAsync(editor, 0, Look(Guid.NewGuid(), thumbnail), Look(Guid.NewGuid(), thumbnail));
        var again = await PutAsync(editor, 1, Look(Guid.Parse(Id(1)), thumbnail));

        var route = ThumbnailsOf(saved)[0];
        Assert.Equal(route, ThumbnailsOf(saved)[1]);
        Assert.Matches("^/api/studio/thumbnails/[0-9a-f]{64}/[0-9a-f-]{36}$", route);
        Assert.DoesNotContain("data:", saved.ToString());
        Assert.Equal(1, files.Uploads);
        var file = Assert.Single(files.Of("studio"));
        Assert.Equal("image/webp", file.ContentType);
        Assert.Contains(files.ReferencesOf(file.Id), reference => reference.RecordType == "studio.thumbnail" && reference.RecordId == file.Sha256);
        Assert.EndsWith($"/{file.Id}", route);
        Assert.Equal(route, ThumbnailsOf(await editor.GetFromJsonAsync<JsonElement>(State))[0]);
        // The same bytes sent again, here from a client still holding the data URL, keep the one file.
        Assert.Equal(1, files.Uploads);
        Assert.Equal(2, again.GetProperty("revision").GetInt64());
    }

    [Fact]
    public async Task Save_ShouldKeepAnOldDataUrlItDoesNotChange_AndStoreTheNewOne()
    {
        var files = new TestFiles();
        await using var host = Host(files);
        var old = DataUrl("old");
        var workspace = StudioAccess_WorkspaceFor(Editor);
        await using (var scope = host.Factory.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<IStudioStateStore>().PutAsync(workspace, StateOf(0, Look(Guid.Parse(Id(1)), old)), default);
        using var editor = await SignedIn(host.Factory, Editor);

        var saved = await PutAsync(editor, 1, Look(Guid.Parse(Id(1)), old), Look(Guid.Parse(Id(2)), DataUrl("new")));

        var thumbnails = ThumbnailsOf(saved);
        Assert.Equal(old, thumbnails[0]);
        Assert.StartsWith("/api/studio/thumbnails/", thumbnails[1]);
        Assert.Equal(1, files.Uploads);
    }

    [Fact]
    public async Task Route_ShouldRedirectAMemberToAFilesLink_AndRefuseOthers()
    {
        var files = new TestFiles();
        await using var host = Host(files);
        using var editor = await SignedIn(host.Factory, Editor);
        var route = ThumbnailsOf(await PutAsync(editor, 0, Look(Guid.NewGuid(), DataUrl("a"))))[0];
        var file = Assert.Single(files.Of("studio"));

        using var member = await editor.GetAsync(route);
        using var otherMember = await (await SignedIn(host.Factory, SecondEditor)).GetAsync(route);
        using var otherOrganization = await (await SignedIn(host.Factory, EditorElsewhere)).GetAsync(route);
        using var noOrganization = await (await SignedIn(host.Factory, Unaffiliated)).GetAsync(route);
        using var anonymous = await Anonymous(host.Factory).GetAsync(route);
        using var unknown = await editor.GetAsync($"/api/studio/thumbnails/{new string('0', 64)}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Redirect, member.StatusCode);
        Assert.Equal(TestFiles.Link(file.Id, null), member.Headers.Location);
        Assert.True(member.Headers.CacheControl!.Private);
        Assert.Equal(TimeSpan.FromSeconds(300), member.Headers.CacheControl.MaxAge);
        Assert.Equal(HttpStatusCode.NotFound, otherMember.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, otherOrganization.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, noOrganization.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Save_ShouldRefuseARouteTheWorkspaceDoesNotHold()
    {
        var files = new TestFiles();
        await using var host = Host(files);
        using var editor = await SignedIn(host.Factory, Editor);
        using var other = await SignedIn(host.Factory, SecondEditor);
        var route = ThumbnailsOf(await PutAsync(editor, 0, Look(Guid.NewGuid(), DataUrl("a"))))[0];

        using var response = await other.PutAsJsonAsync(State, BodyOf(0, Look(Guid.NewGuid(), route)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task WithoutFilesBaseUrl_ShouldKeepDataUrlsInTheState()
    {
        var files = new TestFiles();
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), configure: files.Register);
        using var editor = await SignedIn(host.Factory, Editor);
        var thumbnail = DataUrl("a");

        var saved = await PutAsync(editor, 0, Look(Guid.NewGuid(), thumbnail));
        using var route = await editor.GetAsync($"/api/studio/thumbnails/{new string('0', 64)}/{Guid.NewGuid()}");

        Assert.Equal(thumbnail, ThumbnailsOf(saved)[0]);
        Assert.Equal(0, files.Uploads);
        Assert.Equal(HttpStatusCode.NotFound, route.StatusCode);
    }

    private static StudioHost Host(TestFiles files) =>
        StudioHost.Create(new Dictionary<string, string?> { ["Files:BaseUrl"] = TestFiles.Url }, configure: files.Register);

    private static Guid StudioAccess_WorkspaceFor(Person person) =>
        OcharoStudio.Api.Studio.Access.StudioAccess.WorkspaceFor(person.OrganizationId!.Value, person.Subject);

    private static async Task<JsonElement> PutAsync(HttpClient client, long revision, params object[] looks)
    {
        using var response = await client.PutAsJsonAsync(State, BodyOf(revision, looks));
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static string[] ThumbnailsOf(JsonElement state) =>
        state.GetProperty("looks").EnumerateArray().Select(look => look.GetProperty("thumbnail").GetString()!).ToArray();

    private static object BodyOf(long revision, params object[] looks) =>
        new { revision, draft = (object?)null, looks, settings = new { }, materials = new { } };

    private static StudioState StateOf(long revision, params object[] looks) => new(
        revision, null, JsonSerializer.SerializeToElement(looks), JsonSerializer.SerializeToElement(new { }), JsonSerializer.SerializeToElement(new { }));

    /// <summary>A WebP data URL: a RIFF/WEBP header and a marker that makes its SHA-256 its own.</summary>
    private static string DataUrl(string marker) =>
        "data:image/webp;base64," + Convert.ToBase64String([.. "RIFF"u8, 0, 0, 0, 0, .. "WEBP"u8, .. System.Text.Encoding.UTF8.GetBytes(marker)]);

    private static string Id(int number) => $"0c645d1c-576a-43b8-a8d2-{number:D12}";

    private static object Look(Guid id, string thumbnail) => new
    {
        document = new
        {
            schemaVersion = 1,
            assetVersion = 1,
            id,
            name = "Look",
            garmentId = "nimcha",
            createdAt = "2026-09-25T00:00:00.000Z",
            updatedAt = "2026-09-25T00:00:00.000Z",
            parts = new Dictionary<string, object>
            {
                ["body"] = Assignment("catalogue-synthetic-poplin-paisley-ivory-on-black"),
                ["collar"] = Assignment("pomegranate"),
                ["trim"] = Assignment("pomegranate"),
                ["belt"] = Assignment("pomegranate"),
            },
        },
        thumbnail,
    };

    private static object Assignment(string materialId) => new { materialId, placement = new { rotation = 0, offsetX = 0, offsetY = 0 } };
}
