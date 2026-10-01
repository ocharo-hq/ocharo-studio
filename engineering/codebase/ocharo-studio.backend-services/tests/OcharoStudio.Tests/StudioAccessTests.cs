using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OcharoStudio.Api.Studio.Access;
using OcharoStudio.Persistence;
using Xunit;

namespace OcharoStudio.Tests;

public sealed class StudioAccessTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ocharo-studio-access-" + Guid.NewGuid());
    private readonly DeskTransport _desk = new();
    private readonly WebApplicationFactory<Program> _factory;

    public StudioAccessTests()
    {
        Directory.CreateDirectory(_root);
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["OcharoPlatform:BaseUrl"] = "https://desk.test" }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<StudioDatabaseSettings>();
                services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(_root, "studio.db")}"));
                services.AddHttpClient<StudioAccessClient>().ConfigurePrimaryHttpMessageHandler(() => _desk);
            });
        });
    }

    private HttpClient Client(string? ticket = null)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://studio.test") });
        if (ticket is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ticket);
        return client;
    }

    [Fact]
    public async Task AWorkspaceUuidAloneNeverAuthorizesStorage()
    {
        using var client = Client();
        client.DefaultRequestHeaders.Add("X-Studio-Workspace", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/studio/state")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync("/api/studio/state", EmptyState())).StatusCode);
        Assert.Equal(0, _desk.Requests);
    }

    [Fact]
    public async Task BearerTicketsAreRejectedOverHttp()
    {
        using var client = Client("editor");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("http://studio.test/api/studio/state")).StatusCode);
        Assert.Equal(0, _desk.Requests);
    }

    [Fact]
    public async Task MembershipAndWorkspaceOwnershipAreCheckedOnEveryRequest()
    {
        using var owner = Client("editor");
        var session = await owner.GetFromJsonAsync<JsonElement>("/api/studio/session");
        var workspace = session.GetProperty("workspaceId").GetString();
        owner.DefaultRequestHeaders.Add("X-Studio-Workspace", workspace);
        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync("/api/studio/state", EmptyState())).StatusCode);
        using var other = Client("other-member");
        var otherState = await other.GetFromJsonAsync<JsonElement>("/api/studio/state");
        Assert.Equal(0, otherState.GetProperty("revision").GetInt64());
        other.DefaultRequestHeaders.Add("X-Studio-Workspace", workspace);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync("/api/studio/state")).StatusCode);
        _desk.Revoked = true;
        Assert.Equal(HttpStatusCode.Unauthorized, (await owner.GetAsync("/api/studio/state")).StatusCode);
        Assert.Equal(5, _desk.Requests);
    }

    [Theory]
    [InlineData("viewer", HttpStatusCode.Forbidden)]
    [InlineData("expired", HttpStatusCode.Unauthorized)]
    [InlineData("unknown", HttpStatusCode.Unauthorized)]
    [InlineData("unavailable", HttpStatusCode.Unauthorized)]
    public async Task MissingWriteRightsAndInvalidTicketsFailClosed(string ticket, HttpStatusCode expected)
    {
        using var client = Client(ticket);
        Assert.Equal(expected, (await client.PutAsJsonAsync("/api/studio/state", EmptyState())).StatusCode);
    }

    [Fact]
    public void WorkspaceRoutingSeparatesMembersAndOrganizations()
    {
        var org = Guid.NewGuid();
        var first = StudioIntegrationAuthenticationHandler.WorkspaceFor(org, "a");
        Assert.Equal(first, StudioIntegrationAuthenticationHandler.WorkspaceFor(org, "a"));
        Assert.NotEqual(first, StudioIntegrationAuthenticationHandler.WorkspaceFor(org, "b"));
        Assert.NotEqual(first, StudioIntegrationAuthenticationHandler.WorkspaceFor(Guid.NewGuid(), "a"));
    }

    private static object EmptyState() => new { revision = 0, draft = (object?)null, looks = Array.Empty<object>(), settings = new { }, materials = new { } };

    public void Dispose()
    {
        _factory.Dispose();
        SqliteConnection.ClearAllPools();
        Directory.Delete(_root, true);
    }

    private sealed class DeskTransport : HttpMessageHandler
    {
        public int Requests { get; private set; }
        public bool Revoked { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            Assert.Equal("https://desk.test/api/integrations/introspect", request.RequestUri!.ToString());
            var input = await request.Content!.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            Assert.Equal("ocharo-studio", input.GetProperty("audience").GetString());
            var token = input.GetProperty("token").GetString();
            if (token == "unavailable") return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { data = new {
                    active = !Revoked && token is "editor" or "other-member" or "viewer" or "expired",
                    userId = token == "other-member" ? "member-b" : "member-a",
                    organizationId = Guid.Parse("f74556b7-caf8-41db-a25c-030d1f7d7987"),
                    canEdit = token != "viewer",
                    expiresAt = DateTimeOffset.UtcNow.AddMinutes(token == "expired" ? -1 : 5)
                } })
            };
        }
    }
}
