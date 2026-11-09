using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OcharoStudio.Api.RuntimeConfig.Settings;
using OcharoStudio.Persistence;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.E2E;

/// <summary>Studio serves the Ocharo app addresses as public runtime settings, anonymously and uncached.</summary>
public sealed class RuntimeConfigTests
{
    private static readonly Dictionary<string, string?> EveryApp = new()
    {
        ["OcharoApps:Desk"] = "https://ocharo-desk-dev.example.ts.net/",
        ["OcharoApps:Catalogue"] = "https://ocharo-catalogue-dev.example.ts.net/catalogues",
        ["OcharoApps:Studio"] = "https://ocharo-studio-dev.example.ts.net/studio",
        ["OcharoApps:Marketing"] = "https://ocharo-marketing-dev.example.ts.net/",
        ["OcharoApps:Editorial"] = "https://ocharo-blog-dev.example.ts.net/studio/",
        ["OcharoApps:Brand"] = "https://ocharo-brand-dev.example.ts.net/",
        ["OcharoApps:Atlas"] = "https://ocharo-atlas-dev.example.ts.net/",
        ["OcharoApps:Wear"] = "https://ocharo-wear-dev.example.ts.net/",
        ["OcharoApps:Blog"] = "https://ocharo-blog-dev.example.ts.net/",
    };

    [Fact]
    public async Task RuntimeConfig_ShouldServeEveryConfiguredAddressAnonymouslyAndUncached()
    {
        await using var host = StudioHost.Create(EveryApp);
        using var client = host.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        using var response = await client.GetAsync("/api/runtime-config");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/json");
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        (await ReadAsync(response)).Should().Equal(new Dictionary<string, string>
        {
            ["OCHARO_DESK_URL"] = "https://ocharo-desk-dev.example.ts.net/",
            ["OCHARO_CATALOGUE_URL"] = "https://ocharo-catalogue-dev.example.ts.net/catalogues",
            ["OCHARO_STUDIO_URL"] = "https://ocharo-studio-dev.example.ts.net/studio",
            ["OCHARO_MARKETING_URL"] = "https://ocharo-marketing-dev.example.ts.net/",
            ["OCHARO_EDITORIAL_URL"] = "https://ocharo-blog-dev.example.ts.net/studio/",
            ["OCHARO_BRAND_URL"] = "https://ocharo-brand-dev.example.ts.net/",
            ["OCHARO_ATLAS_URL"] = "https://ocharo-atlas-dev.example.ts.net/",
            ["OCHARO_WEAR_URL"] = "https://ocharo-wear-dev.example.ts.net/",
            ["OCHARO_BLOG_URL"] = "https://ocharo-blog-dev.example.ts.net/",
        });
    }

    [Fact]
    public async Task RuntimeConfig_ShouldAnswerWithoutASession_WhenSignInGuardsTheRestOfTheApi()
    {
        await using var host = StudioHost.Create(EveryApp, realCookieScheme: true);
        using var client = StudioTestIdentity.Anonymous(host.Factory);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/runtime-config");
        request.Headers.Add("Cookie", $"{StudioTestIdentity.CookieName}=forged");

        using var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        (await ReadAsync(response)).Keys.Should().Contain("OCHARO_DESK_URL");
        // The session boundary still holds for the private API, the forged cookie included.
        using var state = new HttpRequestMessage(HttpMethod.Get, "/api/studio/state");
        state.Headers.Add("Cookie", $"{StudioTestIdentity.CookieName}=forged");
        (await client.SendAsync(state)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RuntimeConfig_ShouldDropEveryAddressThatIsNotAPlainHttpsLink()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>
        {
            ["OcharoApps:Desk"] = "http://ocharo-desk-dev.example.ts.net/",
            ["OcharoApps:Catalogue"] = "https://operator:secret@ocharo-catalogue-dev.example.ts.net/",
            ["OcharoApps:Studio"] = "https://ocharo-studio-dev.example.ts.net/studio?token=abc",
            ["OcharoApps:Marketing"] = "https://ocharo-marketing-dev.example.ts.net/#access_token=abc",
            ["OcharoApps:Editorial"] = "/studio/",
            ["OcharoApps:Brand"] = "not a link",
            ["OcharoApps:Atlas"] = "https://ocharo-atlas-dev.example.ts.net/",
            ["OcharoApps:Wear"] = "",
            ["OcharoApps:Blog"] = "javascript:alert(1)",
        });
        using var client = host.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        using var response = await client.GetAsync("/api/runtime-config");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadAsync(response)).Should().Equal(new Dictionary<string, string> { ["OCHARO_ATLAS_URL"] = "https://ocharo-atlas-dev.example.ts.net/" });
    }

    [Fact]
    public async Task RuntimeConfig_ShouldServeAnEmptyObject_WhenNoAddressIsConfigured()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var client = host.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        using var response = await client.GetAsync("/api/runtime-config");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        (await response.Content.ReadAsStringAsync()).Should().Be("{}");
    }

    [Theory]
    [InlineData("https://ocharo-desk-dev.example.ts.net/", true)]
    [InlineData("https://desk.example.com:8443/organizations", true)]
    [InlineData("https://example.com/@handle", true)]
    [InlineData("http://desk.example.com/", false)]
    [InlineData("https://user@desk.example.com/", false)]
    [InlineData("https://desk.example.com/?", false)]
    [InlineData("https://desk.example.com/#", false)]
    [InlineData("https://desk.example.com/a b", false)]
    [InlineData(" https://desk.example.com/", false)]
    [InlineData("//desk.example.com/", false)]
    [InlineData("/organizations", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsPublicAddress_ShouldAcceptOnlyPlainAbsoluteHttpsLinks(string? value, bool accepted)
    {
        OcharoAppsSettingsExtensions.IsPublicAddress(value).Should().Be(accepted);
    }

    [Fact]
    public void RejectedSettings_ShouldNameConfiguredAddressesItLeavesOut()
    {
        var settings = new OcharoAppsSettings { Desk = "http://desk.example.com/", Atlas = "https://atlas.example.com/", Wear = " " };

        settings.RejectedSettings().Should().Equal(["OcharoApps:Desk"]);
    }

    private static async Task<Dictionary<string, string>> ReadAsync(HttpResponseMessage response)
    {
        return JsonSerializer.Deserialize<Dictionary<string, string>>(await response.Content.ReadAsStringAsync())!;
    }
}

/// <summary>An isolated Studio host with its own content root and SQLite file, signed in through
/// <see cref="StudioTestIdentity"/> unless it keeps the real cookie scheme; <c>settings</c> apply last, so a test may change
/// or clear (null) any default.</summary>
internal sealed class StudioHost : IAsyncDisposable
{
    /// <summary>What the host's SPA <c>index.html</c> holds.</summary>
    public const string SpaShell = "studio-shell";

    private StudioHost(string root, WebApplicationFactory<Program> factory)
    {
        Root = root;
        Factory = factory;
    }

    /// <summary>The host's content root, holding its SPA shell.</summary>
    public string Root { get; }

    public WebApplicationFactory<Program> Factory { get; }

    public static StudioHost Create(IReadOnlyDictionary<string, string?> settings, bool realCookieScheme = false, Action<IServiceCollection>? configure = null)
    {
        var root = Path.Combine(Path.GetTempPath(), "ocharo-studio-host-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "wwwroot"));
        File.WriteAllText(Path.Combine(root, "wwwroot", "index.html"), $"<!doctype html><title>{SpaShell}</title>");
        var configuration = StudioTestIdentity.Settings();
        foreach (var (key, value) in settings) configuration[key] = value;
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseContentRoot(root);
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(configuration));
            builder.ConfigureServices(services =>
            {
                if (!realCookieScheme) StudioTestIdentity.Use(services);
                configure?.Invoke(services);
            });
        });
        return new StudioHost(root, factory);
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        try { Directory.Delete(Root, true); } catch (IOException) { }
    }
}
