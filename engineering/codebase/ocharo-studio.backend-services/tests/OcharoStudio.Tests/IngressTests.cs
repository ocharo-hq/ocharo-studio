using System.Net;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Identity.Bff;
using Xunit;

namespace OcharoStudio.Tests;

/// <summary>
/// Behind the ingress, TLS ends at Traefik and the container sees plain HTTP from its address. Forwarded scheme and
/// host apply only from a proxy listed under <c>Deployment:TrustedProxies</c>, and before authentication, so the session
/// routes and the sign-in see https and the public host; any other sender keeps its own scheme and host.
/// </summary>
public sealed class IngressTests : IDisposable
{
    private const string Traefik = "172.30.0.2";
    private const string PublicHost = "studio.example.test";
    private const string AuthorizeEndpoint = "https://identity.example.test/connect/authorize";
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ocharo-studio-ingress-" + Guid.NewGuid());

    public IngressTests() => Directory.CreateDirectory(_root);

    [Theory]
    [InlineData(Traefik, Traefik, StatusCodes.Status200OK)]
    [InlineData(Traefik, "172.30.0.9", StatusCodes.Status400BadRequest)] // another workload on the platform network
    [InlineData(null, Traefik, StatusCodes.Status400BadRequest)]         // the checked-in default trusts loopback only
    public async Task SessionRouteSeesHttpsOnlyFromATrustedProxy(string? trusted, string sender, int expected)
    {
        using var factory = Factory(trusted);

        var response = await SendAsync(factory, sender, "/api/identity/session", _ => { });

        Assert.Equal(expected, response.Response.StatusCode);
    }

    [Theory]
    [InlineData(Traefik, StatusCodes.Status302Found)]
    [InlineData("172.30.0.9", StatusCodes.Status400BadRequest)]
    public async Task SignInSeesThePublicOriginOnlyFromATrustedProxy(string sender, int expected)
    {
        using var factory = Factory(Traefik);

        var response = await SendAsync(factory, sender, "/api/identity/sign-in", http =>
            http.Request.QueryString = new QueryString("?returnUrl=%2Fstudio"));

        Assert.Equal(expected, response.Response.StatusCode);
        if (expected == StatusCodes.Status302Found)
        {
            var location = response.Response.Headers.Location.ToString();
            Assert.StartsWith(AuthorizeEndpoint + "?", location);
            Assert.Contains(Uri.EscapeDataString($"https://{PublicHost}/api/identity/callback"), location);
            Assert.Contains(".AspNetCore.Correlation.", response.Response.Headers.SetCookie.ToString());
        }
    }

    /// <summary>The real cookie and OpenID Connect schemes, with the instance's discovery answered in-process.</summary>
    private WebApplicationFactory<Program> Factory(string? trusted) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            foreach (var (key, value) in StudioTestIdentity.Settings())
                builder.UseSetting(key, value);
            if (trusted is not null) builder.UseSetting("Deployment:TrustedProxies:0", trusted);

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<StudioDatabaseSettings>();
                services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(_root, "studio.db")};Pooling=False"));
                services.Configure<OpenIdConnectOptions>(BffAuthenticationSchemeConstants.OpenIdConnect, options =>
                    options.Configuration = new OpenIdConnectConfiguration { AuthorizationEndpoint = AuthorizeEndpoint });
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
}
