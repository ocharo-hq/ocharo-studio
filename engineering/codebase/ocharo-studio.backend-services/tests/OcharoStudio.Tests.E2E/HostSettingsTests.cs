using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using OcharoStudio.Api.Configurations;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Foundation.Configuration;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.E2E;

/// <summary>
/// The host's settings rules: only a local run — Development without the runner's <c>DEPLOY_ENVIRONMENT</c> — reads this
/// machine's <c>appsettings.Local.json</c> (and only when its launch profile asks) or maps OpenAPI; every run reads the
/// <c>appsettings.Target.json</c> a deployed target mounts, and a deployed host starts as Production from it.
/// </summary>
public sealed class HostSettingsTests : IDisposable
{
    private const string TargetAuthority = "https://identity.target.test/";
    private const string LocalAuthority = "https://identity.local.test/";
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ocharo-studio-settings-" + Guid.NewGuid());

    public HostSettingsTests()
    {
        Directory.CreateDirectory(_root);
        File.WriteAllText(Path.Combine(_root, "appsettings.Target.json"),
            $$"""{ "Identity": { "Client": { "Authority": "{{TargetAuthority}}" } } }""");
        File.WriteAllText(Path.Combine(_root, "appsettings.Local.json"),
            $$"""{ "Identity": { "Client": { "Authority": "{{LocalAuthority}}" } } }""");
    }

    [Theory]
    [InlineData("Development", null, "true", LocalAuthority)]   // the https launch profile
    [InlineData("Development", null, null, TargetAuthority)]  // a local run whose profile never asked
    [InlineData("Development", "dev", "true", TargetAuthority)] // deployed dev runs as Development; the runner names it
    [InlineData("Production", null, "true", TargetAuthority)]
    public void SettingsFilesFollowTheLocalRun(string environment, string? deployed, string? localSettings, string expected)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environment,
            ContentRootPath = _root,
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DEPLOY_ENVIRONMENT"] = deployed,
            ["LOCAL_SETTINGS"] = localSettings,
        });

        builder.Configure();

        builder.Configuration["Identity:Client:Authority"].Should().Be(expected);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.OK)]
    [InlineData("dev", HttpStatusCode.NotFound)]
    public async Task OpenApiIsMappedOnALocalRunOnly(string? deployed, HttpStatusCode expected)
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            if (deployed is not null) builder.UseSetting("DEPLOY_ENVIRONMENT", deployed);
            foreach (var (key, value) in StudioTestIdentity.Settings())
                builder.UseSetting(key, value);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<StudioDatabaseSettings>();
                services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(_root, "studio.db")};Pooling=False"));
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://studio.test") });

        (await client.GetAsync("/openapi/v1.json")).StatusCode.Should().Be(expected);
    }

    [Fact]
    public async Task ADeployedHostStartsAsProductionFromItsTargetSettings()
    {
        var root = Path.Combine(_root, "deployed");
        Directory.CreateDirectory(Path.Combine(root, "wwwroot"));
        File.Copy(Path.Combine(ApiProject(), "appsettings.json"), Path.Combine(root, "appsettings.json"));
        File.WriteAllText(Path.Combine(root, "wwwroot", "index.html"), "<!doctype html><title>studio-shell</title>");
        var database = Path.Combine(root, "appdata", "ocharo-studio.db");
        File.WriteAllText(Path.Combine(root, "appsettings.Target.json"), $$"""
            {
              "ConnectionStrings": { "Studio": "Data Source={{database}};Pooling=False" },
              "Identity": { "Client": { "Authority": "{{TargetAuthority}}", "ClientId": "studio", "CookieName": "__Host-ocharo-studio" } },
              "Deployment": { "TrustedProxies": [ "172.30.0.2" ] }
            }
            """);
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Production);
            builder.UseContentRoot(root);
            builder.UseSetting("DEPLOY_ENVIRONMENT", "dev");
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://studio.test") });

        (await client.GetAsync("/health")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/api/system/version")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/openapi/v1.json")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetStringAsync("/studio")).Should().Contain("studio-shell");
        var environment = factory.Services.GetRequiredService<IHostEnvironment>();
        var configuration = factory.Services.GetRequiredService<IConfiguration>();
        environment.EnvironmentName.Should().Be(Environments.Production);
        environment.IsLocalRun(configuration).Should().BeFalse();
        configuration["Identity:Client:Authority"].Should().Be(TargetAuthority);
        File.Exists(database).Should().BeTrue();
        var keyRing = factory.Services.GetRequiredService<IOptions<KeyManagementOptions>>().Value.XmlRepository;
        keyRing.Should().BeOfType<FileSystemXmlRepository>().Which.Directory.FullName.Should().Be(Path.Combine(root, "appdata", "keys"));
    }

    /// <summary>The API project folder, found above the test output, so the deployed test reads its checked-in settings.</summary>
    private static string ApiProject()
    {
        for (var folder = new DirectoryInfo(AppContext.BaseDirectory); folder is not null; folder = folder.Parent)
        {
            var candidate = Path.Combine(folder.FullName, "OcharoStudio.Api");
            if (File.Exists(Path.Combine(candidate, "appsettings.json"))) return candidate;
        }

        throw new InvalidOperationException("OcharoStudio.Api was not found above the test output.");
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(_root, true);
    }
}
