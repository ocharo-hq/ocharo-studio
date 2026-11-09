using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OcharoStudio.Api.Studio.Access;
using AwesomeAssertions;
using Xunit;
using static OcharoStudio.Tests.E2E.StudioTestIdentity;

using OcharoStudio.Persistence;
using Microsoft.Extensions.Caching.Distributed;
using WoW.Two.Sdk.Beta.Be.Caching.Postgres;
namespace OcharoStudio.Tests.E2E;

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
        StudioAccess.WorkspaceFor(Guid.Parse("11111111-1111-1111-1111-111111111111"), "22222222-2222-2222-2222-222222222222").Should().Be(Guid.Parse("909a2adc-3737-2513-de34-a7bb6f29a55d"));
    }

    [Fact]
    public void WorkspaceFor_ShouldSeparateSubjectsAndOrganizations()
    {
        var first = StudioAccess.WorkspaceFor(Organization, "a");

        StudioAccess.WorkspaceFor(Organization, "a").Should().Be(first);
        StudioAccess.WorkspaceFor(Organization, "b").Should().NotBe(first);
        StudioAccess.WorkspaceFor(OtherOrganization, "a").Should().NotBe(first);
    }

    [Fact]
    public async Task Session_ShouldNameTheWorkspaceOfTheSessionsOrganizationAndSubject()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = await SignedIn(host.Factory, Pinned);

        using var response = await client.GetAsync(Session);
        var session = await response.Content.ReadFromJsonAsync<JsonElement>();

        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        session.EnumerateObject().Select(item => item.Name).Order().ToArray().Should().Equal(new[] { "canEdit", "organizationId", "userId", "workspaceId" });
        session.GetProperty("workspaceId").GetString().Should().Be("909a2adc-3737-2513-de34-a7bb6f29a55d");
        session.GetProperty("userId").GetString().Should().Be("22222222-2222-2222-2222-222222222222");
        session.GetProperty("organizationId").GetString().Should().Be("11111111-1111-1111-1111-111111111111");
    }

    [Fact]
    public async Task SignalRoute_ShouldAnswer401_ForAnUnsignedPostWithoutASession()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?> { ["Identity:Client:SignalUrl"] = "https://app.test/api/identity/signal" });
        using var client = Anonymous(host.Factory);

        var response = await client.PostAsJsonAsync("/api/identity/signal", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task IdentitySessionRoute_ShouldCarryExpiryPermissionsAndCsrfToken()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = await SignedIn(host.Factory, Editor, csrf: false);

        var session = await IdentitySessionAsync(client);

        session.GetProperty("isAuthenticated").GetBoolean().Should().BeTrue();
        session.GetProperty("person").GetProperty("sub").GetString().Should().Be("editor-sub");
        session.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).Should().Equal(new string?[] { StudioAccess.EditPermission });
        string.IsNullOrEmpty(session.GetProperty("csrfToken").GetString()).Should().BeFalse();
        (session.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow).Should().BeTrue();
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
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            if (realCookieScheme) (await CodeAsync(response)).Should().Be("SignInRequired");
        }
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/system/status")]
    [InlineData("/api/runtime-config")]
    [InlineData("/api/studio")]
    public async Task TechnicalRoutes_ShouldAnswerWithoutASession(string path)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        using var client = Anonymous(host.Factory);

        (await client.GetAsync(path)).StatusCode.Should().Be(HttpStatusCode.OK);
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

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).Should().Contain(StudioHost.SpaShell);
    }

    [Fact]
    public async Task StaticFiles_ShouldAnswerWithoutASession()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        await File.WriteAllTextAsync(Path.Combine(host.Root, "wwwroot", "app.js"), "// app");
        using var client = Anonymous(host.Factory);

        (await client.GetAsync("/app.js")).StatusCode.Should().Be(HttpStatusCode.OK);
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

        session.GetProperty("canEdit").GetBoolean().Should().BeTrue();
        session.GetProperty("workspaceId").GetGuid().Should().Be(StudioAccess.WorkspaceFor(Organization, Editor.Subject));
        empty.GetProperty("revision").GetInt64().Should().Be(0);
        write.StatusCode.Should().Be(HttpStatusCode.OK);
        saved.GetProperty("revision").GetInt64().Should().Be(1);
    }

    [Fact]
    public async Task MemberWithoutEditPermission_ShouldReadButNotWrite()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var viewer = await SignedIn(host.Factory, Viewer);

        var session = await viewer.GetFromJsonAsync<JsonElement>(Session);
        using var read = await viewer.GetAsync(State);
        using var write = await viewer.PutAsJsonAsync(State, EmptyState());

        session.GetProperty("canEdit").GetBoolean().Should().BeFalse();
        read.StatusCode.Should().Be(HttpStatusCode.OK);
        write.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SessionWithoutARoleInItsActiveOrganization_ShouldBeForbidden()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        foreach (var person in new[] { Unaffiliated, RoleLess, RoleElsewhere })
        {
            using var client = await SignedIn(host.Factory, person);

            (await client.GetAsync(Session)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.GetAsync(State)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.PutAsJsonAsync(State, EmptyState())).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            // Signed in all the same, and everything anonymous still answers.
            (await IdentitySessionAsync(client)).GetProperty("isAuthenticated").GetBoolean().Should().BeTrue();
            (await client.GetAsync("/api/studio")).StatusCode.Should().Be(HttpStatusCode.OK);
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
            refused.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            (await CodeAsync(refused)).Should().Be("AntiforgeryValidationFailed");
        }

        (await forger.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64().Should().Be(0);
        (await editor.PutAsJsonAsync(State, EmptyState())).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task WorkspaceHeader_ShouldSelectOnlyTheAuthenticatedWorkspace()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);
        var own = (await editor.GetFromJsonAsync<JsonElement>(Session)).GetProperty("workspaceId").GetString()!;
        using var other = await SignedIn(host.Factory, SecondEditor);
        var others = (await other.GetFromJsonAsync<JsonElement>(Session)).GetProperty("workspaceId").GetString()!;

        others.Should().NotBe(own);
        (await SendAsync(editor, HttpMethod.Get, own)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await SendAsync(editor, HttpMethod.Put, own)).StatusCode.Should().Be(HttpStatusCode.OK);
        foreach (var selected in new[] { others, Guid.NewGuid().ToString(), "not-a-guid" })
        {
            (await SendAsync(editor, HttpMethod.Get, selected)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await SendAsync(editor, HttpMethod.Put, selected)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }

    [Fact]
    public async Task Workspaces_ShouldKeepMembersAndOrganizationsApart()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);
        using var sameOrganization = await SignedIn(host.Factory, SecondEditor);
        using var sameSubject = await SignedIn(host.Factory, EditorElsewhere);

        (await editor.PutAsJsonAsync(State, EmptyState())).StatusCode.Should().Be(HttpStatusCode.OK);

        (await editor.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64().Should().Be(1);
        (await sameOrganization.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64().Should().Be(0);
        var elsewhere = await sameSubject.GetFromJsonAsync<JsonElement>(Session);
        elsewhere.GetProperty("organizationId").GetGuid().Should().Be(OtherOrganization);
        elsewhere.GetProperty("workspaceId").GetGuid().Should().Be(StudioAccess.WorkspaceFor(OtherOrganization, Editor.Subject));
        (await sameSubject.GetFromJsonAsync<JsonElement>(State)).GetProperty("revision").GetInt64().Should().Be(0);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BearerTokens_ShouldGrantNothing(bool realCookieScheme)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme);
        using var client = Anonymous(host.Factory);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "editor");

        (await client.GetAsync(Session)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.GetAsync(State)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.PutAsJsonAsync(State, EmptyState())).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await IdentitySessionAsync(client)).GetProperty("isAuthenticated").GetBoolean().Should().BeFalse();
    }

    [Theory]
    [InlineData("Identity:Client:Authority")]
    [InlineData("Identity:Client:ClientId")]
    public async Task Host_ShouldRefuseToBoot_WithoutAnIdentityClient(string key)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?> { [key] = null });

        var failure = FluentActions.Invoking(() => Anonymous(host.Factory)).Should().Throw<Exception>().Which;

        failure.Message.Should().Contain(key);
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

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeAsync(response)).Should().Be("https_required");
    }

    [Fact]
    public async Task KeyRingAndSessions_ShouldLiveInTheProductDatabase_SoARestartKeepsThem()
    {
        var settings = StudioTestIdentity.Settings();
        await using var first = StudioHost.Create(settings);
        await using var restarted = StudioHost.Create(settings);

        first.Factory.Services.GetRequiredService<IOptions<KeyManagementOptions>>().Value.XmlRepository.Should().BeOfType<PostgresXmlRepository>();
        first.Factory.Services.GetRequiredService<IDistributedCache>().Should().BeOfType<PostgresDistributedCache>();
        // The first session's CSRF token creates the key, in the database the next host reads.
        using var client = await SignedIn(first.Factory, Editor);
        restarted.Factory.Services.GetRequiredService<IOptions<KeyManagementOptions>>().Value.XmlRepository!.GetAllElements().Should().NotBeEmpty();
        await first.Factory.Services.GetRequiredService<IDistributedCache>().SetStringAsync("session-probe", "kept");
        (await restarted.Factory.Services.GetRequiredService<IDistributedCache>().GetStringAsync("session-probe")).Should().Be("kept");
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

        ((int)response.StatusCode).Should().Be(expected);
        (response.Content.Headers.ContentType?.MediaType).Should().Be("application/problem+json");
        (response.Headers.CacheControl?.NoStore).Should().BeTrue();
        var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        problem.GetProperty("status").GetInt32().Should().Be(expected);
        string.IsNullOrWhiteSpace(problem.GetProperty("type").GetString()).Should().BeFalse();
        string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()).Should().BeFalse();
        problem.GetProperty("instance").GetString().Should().Be(path);
        string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()).Should().BeFalse();
        string.IsNullOrWhiteSpace(problem.GetProperty("requestId").GetString()).Should().BeFalse();
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
