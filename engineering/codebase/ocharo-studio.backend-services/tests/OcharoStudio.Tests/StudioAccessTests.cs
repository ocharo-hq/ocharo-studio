using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OcharoStudio.Api.Studio.Access;
using Xunit;
using static OcharoStudio.Tests.StudioTestIdentity;

namespace OcharoStudio.Tests;

/// <summary>
/// Studio signs in through Ocharo's Identity BFF and stays usable without signing in: only the session and state routes need
/// a session, of a member of its active organization; writing needs <c>studio:edit</c> and the session's <c>X-Csrf-Token</c>.
/// </summary>
public sealed class StudioAccessTests
{
    private const string Session = "/api/studio/session";
    private const string State = "/api/studio/state";

    [Fact]
    public void WorkspaceFor_ShouldKeepItsExactBytes()
    {
        // Computed by the Desk-ticket build before the move; a change here orphans every saved design.
        Assert.Equal(
            Guid.Parse("909a2adc-3737-2513-de34-a7bb6f29a55d"),
            StudioAccess.WorkspaceFor(Guid.Parse("11111111-1111-1111-1111-111111111111"), "22222222-2222-2222-2222-222222222222"));
    }

    [Fact]
    public void WorkspaceFor_ShouldSeparateSubjectsAndOrganizations()
    {
        var first = StudioAccess.WorkspaceFor(Organization, "a");

        Assert.Equal(first, StudioAccess.WorkspaceFor(Organization, "a"));
        Assert.NotEqual(first, StudioAccess.WorkspaceFor(Organization, "b"));
        Assert.NotEqual(first, StudioAccess.WorkspaceFor(OtherOrganization, "a"));
    }

    [Fact]
    public async Task Session_ShouldNameTheWorkspaceOfTheSessionsOrganizationAndSubject()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = await SignedIn(host.Factory, Pinned);

        using var response = await client.GetAsync(Session);
        var session = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Equal(new[] { "canEdit", "organizationId", "userId", "workspaceId" }, session.EnumerateObject().Select(item => item.Name).Order().ToArray());
        Assert.Equal("909a2adc-3737-2513-de34-a7bb6f29a55d", session.GetProperty("workspaceId").GetString());
        Assert.Equal("22222222-2222-2222-2222-222222222222", session.GetProperty("userId").GetString());
        Assert.Equal("11111111-1111-1111-1111-111111111111", session.GetProperty("organizationId").GetString());
    }

    [Fact]
    public async Task SignalRoute_ShouldAnswer401_ForAnUnsignedPostWithoutASession()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?> { ["Identity:Client:SignalUrl"] = "https://app.test/api/identity/signal" });
        using var client = Anonymous(host.Factory);

        var response = await client.PostAsJsonAsync("/api/identity/signal", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task IdentitySessionRoute_ShouldCarryExpiryPermissionsAndCsrfToken()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = await SignedIn(host.Factory, Editor, csrf: false);

        var session = await IdentitySessionAsync(client);

        Assert.True(session.GetProperty("isAuthenticated").GetBoolean());
        Assert.Equal("editor-sub", session.GetProperty("person").GetProperty("sub").GetString());
        Assert.Equal(new string?[] { StudioAccess.EditPermission }, session.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
        Assert.False(string.IsNullOrEmpty(session.GetProperty("csrfToken").GetString()));
        Assert.True(session.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnonymousRequests_ShouldNeedASessionOnEveryAuthorizedRoute(bool realCookieScheme)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme);
        using var client = Anonymous(host.Factory);
        // A workspace UUID alone never authorizes storage.
        client.DefaultRequestHeaders.Add("X-Studio-Workspace", Guid.NewGuid().ToString());

        foreach (var response in new[] { await client.GetAsync(Session), await client.GetAsync(State), await client.PutAsJsonAsync(State, EmptyState()) })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            if (realCookieScheme) Assert.Equal("SignInRequired", await CodeAsync(response));
        }
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/system/version")]
    [InlineData("/api/system/status")]
    [InlineData("/api/runtime-config")]
    [InlineData("/api/studio")]
    public async Task TechnicalRoutes_ShouldAnswerWithoutASession(string path)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        using var client = Anonymous(host.Factory);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(path)).StatusCode);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/studio")]
    [InlineData("/studio/looks/1")]
    public async Task SpaRoutes_ShouldFallBackToIndexHtmlWithoutASession(string path)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        using var client = Anonymous(host.Factory);
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.ParseAdd("text/html");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(StudioHost.SpaShell, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task StaticFiles_ShouldAnswerWithoutASession()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        await File.WriteAllTextAsync(Path.Combine(host.Root, "wwwroot", "app.js"), "// app");
        using var client = Anonymous(host.Factory);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/app.js")).StatusCode);
    }

    [Fact]
    public async Task EditPermission_ShouldLetAMemberReadAndWrite()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);

        var session = await editor.GetFromJsonAsync<JsonElement>(Session);
        var empty = await editor.GetFromJsonAsync<JsonElement>(State);
        using var write = await editor.PutAsJsonAsync(State, EmptyState());
        var saved = await editor.GetFromJsonAsync<JsonElement>(State);

        Assert.True(session.GetProperty("canEdit").GetBoolean());
        Assert.Equal(StudioAccess.WorkspaceFor(Organization, Editor.Subject), session.GetProperty("workspaceId").GetGuid());
        Assert.Equal(0, empty.GetProperty("revision").GetInt64());
        Assert.Equal(HttpStatusCode.OK, write.StatusCode);
        Assert.Equal(1, saved.GetProperty("revision").GetInt64());
    }

    [Fact]
    public async Task MemberWithoutEditPermission_ShouldReadButNotWrite()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var viewer = await SignedIn(host.Factory, Viewer);

        var session = await viewer.GetFromJsonAsync<JsonElement>(Session);
        using var read = await viewer.GetAsync(State);
        using var write = await viewer.PutAsJsonAsync(State, EmptyState());

        Assert.False(session.GetProperty("canEdit").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
    }

    [Fact]
    public async Task SessionWithoutARoleInItsActiveOrganization_ShouldBeForbidden()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        foreach (var person in new[] { Unaffiliated, RoleLess, RoleElsewhere })
        {
            using var client = await SignedIn(host.Factory, person);

            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Session)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(State)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(State, EmptyState())).StatusCode);
            // Signed in all the same, and everything anonymous still answers.
            Assert.True((await IdentitySessionAsync(client)).GetProperty("isAuthenticated").GetBoolean());
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/studio")).StatusCode);
        }
    }

    [Fact]
    public async Task WritesOfASession_ShouldNeedItsCsrfToken()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var forger = await SignedIn(host.Factory, Editor, csrf: false);
        using var otherSession = await SignedIn(host.Factory, SecondEditor);
        using var editor = await SignedIn(host.Factory, Editor);

        using var missing = await forger.PutAsJsonAsync(State, EmptyState());
        using var foreign = await Forged(forger, otherSession.DefaultRequestHeaders.GetValues("X-Csrf-Token").Single());
        using var wrong = await Forged(forger, "not-a-token");

        foreach (var refused in new[] { missing, foreign, wrong })
        {
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("AntiforgeryValidationFailed", await CodeAsync(refused));
        }

        Assert.Equal(0, (await forger.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64());
        Assert.Equal(HttpStatusCode.OK, (await editor.PutAsJsonAsync(State, EmptyState())).StatusCode);
    }

    [Fact]
    public async Task WorkspaceHeader_ShouldSelectOnlyTheAuthenticatedWorkspace()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);
        var own = (await editor.GetFromJsonAsync<JsonElement>(Session)).GetProperty("workspaceId").GetString()!;
        using var other = await SignedIn(host.Factory, SecondEditor);
        var others = (await other.GetFromJsonAsync<JsonElement>(Session)).GetProperty("workspaceId").GetString()!;

        Assert.NotEqual(own, others);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Get, own)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Put, own)).StatusCode);
        foreach (var selected in new[] { others, Guid.NewGuid().ToString(), "not-a-guid" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Get, selected)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Put, selected)).StatusCode);
        }
    }

    [Fact]
    public async Task Workspaces_ShouldKeepMembersAndOrganizationsApart()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);
        using var sameOrganization = await SignedIn(host.Factory, SecondEditor);
        using var sameSubject = await SignedIn(host.Factory, EditorElsewhere);

        Assert.Equal(HttpStatusCode.OK, (await editor.PutAsJsonAsync(State, EmptyState())).StatusCode);

        Assert.Equal(1, (await editor.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64());
        Assert.Equal(0, (await sameOrganization.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64());
        var elsewhere = await sameSubject.GetFromJsonAsync<JsonElement>(Session);
        Assert.Equal(OtherOrganization, elsewhere.GetProperty("organizationId").GetGuid());
        Assert.Equal(StudioAccess.WorkspaceFor(OtherOrganization, Editor.Subject), elsewhere.GetProperty("workspaceId").GetGuid());
        Assert.Equal(0, (await sameSubject.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BearerTokens_ShouldGrantNothing(bool realCookieScheme)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme);
        using var client = Anonymous(host.Factory);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "editor");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Session)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(State)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync(State, EmptyState())).StatusCode);
        Assert.False((await IdentitySessionAsync(client)).GetProperty("isAuthenticated").GetBoolean());
    }

    [Theory]
    [InlineData("Identity:Client:Authority")]
    [InlineData("Identity:Client:ClientId")]
    public async Task Host_ShouldRefuseToBoot_WithoutAnIdentityClient(string key)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?> { [key] = null });

        var failure = Assert.ThrowsAny<Exception>(() => Anonymous(host.Factory));

        Assert.Contains(key, failure.Message);
    }

    [Theory]
    [InlineData("/api/identity/session", "GET")]
    [InlineData("/api/identity/sign-in", "GET")]
    [InlineData("/api/identity/sign-out", "POST")]
    public async Task SessionRoutes_ShouldNeedHttps(string path, string method)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = Anonymous(host.Factory, "http://localhost");

        using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("https_required", await CodeAsync(response));
    }

    [Fact]
    public async Task KeyRing_ShouldLiveBesideTheDatabase_UnlessKeysPathNamesAnother()
    {
        await using var byDefault = StudioHost.Create(new Dictionary<string, string?>());
        var elsewhere = Path.Combine(Path.GetTempPath(), "ocharo-studio-keys", Guid.NewGuid().ToString("N"));
        await using var named = StudioHost.Create(new Dictionary<string, string?> { ["DataProtection:KeysPath"] = elsewhere });

        Assert.Equal(Path.Combine(byDefault.Root, "keys"), KeyRingFolder(byDefault));
        Assert.Equal(elsewhere, KeyRingFolder(named));
        // The first session's CSRF token creates the key, on disk.
        using var client = await SignedIn(byDefault.Factory, Editor);
        Assert.NotEmpty(Directory.GetFiles(Path.Combine(byDefault.Root, "keys"), "key-*.xml"));
    }

    [Theory]
    [InlineData(null, "GET", State, null, null, 401)]
    [InlineData("viewer", "PUT", State, "application/json", "{}", 403)]
    [InlineData("editor", "GET", "/api/missing-contract-route", null, null, 404)]
    [InlineData("editor", "PUT", State, "application/json", "{", 400)]
    [InlineData("editor", "PUT", State, "text/plain", "invalid", 415)]
    public async Task ErrorsRemainProblemJsonWhenHtmlIsRequested(string? person, string method, string path, string? contentType, string? body, int expected)
    {
        // The anonymous case answers from the real cookie scheme, as a deployed host does.
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: person is null);
        using var client = person switch
        {
            "viewer" => await SignedIn(host.Factory, Viewer),
            "editor" => await SignedIn(host.Factory, Editor),
            _ => Anonymous(host.Factory),
        };
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        request.Headers.Accept.ParseAdd("text/html");
        if (body is not null) request.Content = new StringContent(body, System.Text.Encoding.UTF8, contentType!);

        using var response = await client.SendAsync(request);

        Assert.Equal(expected, (int)response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(expected, problem.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("type").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()));
        Assert.Equal(path, problem.GetProperty("instance").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("requestId").GetString()));
    }

    private static string KeyRingFolder(StudioHost host)
    {
        var repository = host.Factory.Services.GetRequiredService<IOptions<KeyManagementOptions>>().Value.XmlRepository;
        return Assert.IsType<FileSystemXmlRepository>(repository).Directory.FullName;
    }

    private static Task<HttpResponseMessage> Forged(HttpClient client, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, State) { Content = JsonContent.Create(EmptyState()) };
        request.Headers.Add("X-Csrf-Token", token);
        return client.SendAsync(request);
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string workspace)
    {
        var request = new HttpRequestMessage(method, State);
        request.Headers.Add("X-Studio-Workspace", workspace);
        if (method == HttpMethod.Put) request.Content = JsonContent.Create(EmptyState());
        return client.SendAsync(request);
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(text)) return null;
        using var document = JsonDocument.Parse(text);
        return document.RootElement.ValueKind == JsonValueKind.Object && document.RootElement.TryGetProperty("code", out var code)
            ? code.GetString() : null;
    }

    private static object EmptyState() => new { revision = 0, draft = (object?)null, looks = Array.Empty<object>(), settings = new { }, materials = new { } };
}
