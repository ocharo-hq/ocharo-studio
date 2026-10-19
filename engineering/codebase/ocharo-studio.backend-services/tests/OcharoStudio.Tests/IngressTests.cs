using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OcharoStudio.Api.Studio.Access;
using OcharoStudio.Persistence;
using Xunit;

namespace OcharoStudio.Tests;

/// <summary>
/// Behind the ingress, TLS ends at Traefik and the container sees plain HTTP from its address. Forwarded scheme and
/// host apply only from a proxy listed under <c>Deployment:TrustedProxies</c>, so Desk tickets and the account sign-in
/// see https and the public host; any other sender keeps its own scheme and host.
/// </summary>
public sealed class IngressTests : IDisposable
{
    private const string Traefik = "172.30.0.2";
    private const string PublicHost = "studio.example.test";
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ocharo-studio-ingress-" + Guid.NewGuid());
    private readonly DeskTransport _desk = new();

    public IngressTests() => Directory.CreateDirectory(_root);

    [Theory]
    [InlineData(Traefik, Traefik, HttpStatusCode.OK)]
    [InlineData(Traefik, "172.30.0.9", HttpStatusCode.Unauthorized)] // another workload on the platform network
    [InlineData(null, Traefik, HttpStatusCode.Unauthorized)]         // the checked-in default trusts loopback only
    public async Task DeskTicketsSeeHttpsOnlyFromATrustedProxy(string? trusted, string sender, HttpStatusCode expected)
    {
        using var factory = Factory(trusted);

        var response = await SendAsync(factory, sender, "/api/studio/session", http =>
            http.Request.Headers.Authorization = "Bearer editor");

        Assert.Equal((int)expected, response.Response.StatusCode);
        Assert.Equal(expected == HttpStatusCode.OK ? 1 : 0, _desk.Requests);
    }

    [Theory]
    [InlineData(Traefik, StatusCodes.Status302Found)]
    [InlineData("172.30.0.9", StatusCodes.Status400BadRequest)]
    public async Task AccountSignInSeesThePublicOriginOnlyFromATrustedProxy(string sender, int expected)
    {
        using var factory = Factory(Traefik, sso: true);

        var response = await SendAsync(factory, sender, "/api/sso/login", http =>
            http.Request.QueryString = new QueryString("?returnUrl=%2Fstudio"));

        Assert.Equal(expected, response.Response.StatusCode);
        if (expected == StatusCodes.Status302Found)
        {
            var location = response.Response.Headers.Location.ToString();
            Assert.StartsWith("https://desk.test/api/sso/authorize?", location);
            Assert.Contains(Uri.EscapeDataString($"https://{PublicHost}/api/sso/callback"), location);
            Assert.Contains("__Host-ocharo-studio-correlation=", response.Response.Headers.SetCookie.ToString());
        }
    }

    private WebApplicationFactory<Program> Factory(string? trusted, bool sso = false) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("OcharoPlatform:BaseUrl", "https://desk.test");
            if (trusted is not null) builder.UseSetting("Deployment:TrustedProxies:0", trusted);
            if (sso)
            {
                builder.UseSetting("Identity:Sso:Enabled", "true");
                builder.UseSetting("Identity:Sso:DeskOrigin", "https://desk.test");
                builder.UseSetting("Identity:Sso:ClientOrigin", $"https://{PublicHost}");
                builder.UseSetting("Identity:Sso:ClientId", "studio");
                builder.UseSetting("Identity:Sso:ClientSecret", new string('s', 32));
            }

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<StudioDatabaseSettings>();
                services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(_root, "studio.db")};Pooling=False"));
                services.AddHttpClient<StudioAccessClient>().ConfigurePrimaryHttpMessageHandler(() => _desk);
            });
        });

    /// <summary>Sends what Traefik forwards: plain HTTP to the container's own address, with the public scheme and host.</summary>
    private static Task<HttpContext> SendAsync(WebApplicationFactory<Program> factory, string sender, string path, Action<HttpContext> configure) =>
        factory.Server.SendAsync(http =>
        {
            http.Request.Method = HttpMethods.Get;
            http.Request.Scheme = "http";
            http.Request.Host = new HostString("ocharo-studio-dev-studio:8080");
            http.Request.Path = path;
            http.Request.Headers["X-Forwarded-Proto"] = "https";
            http.Request.Headers["X-Forwarded-Host"] = PublicHost;
            http.Request.Headers["X-Forwarded-For"] = "203.0.113.7";
            http.Connection.RemoteIpAddress = IPAddress.Parse(sender);
            configure(http);
        });

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(_root, true);
    }

    /// <summary>Answers Desk introspection for the one <c>editor</c> ticket.</summary>
    private sealed class DeskTransport : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new
                {
                    data = new
                    {
                        active = true,
                        userId = "member-a",
                        organizationId = Guid.Parse("f74556b7-caf8-41db-a25c-030d1f7d7987"),
                        canEdit = true,
                        expiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
                    },
                }),
            });
        }
    }
}
