using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Mediator;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.E2E;

/// <summary>Verifies the real host resolves application handlers and initializes overridden state storage.</summary>
public sealed class HostCompositionTests
{
    [Fact]
    public async Task StartupPreservesStorageOverridesAndServiceLifetimes()
    {
        var root = Path.Combine(Path.GetTempPath(), "ocharo-studio-host-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        try
        {
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                foreach (var (key, value) in StudioTestIdentity.Settings())
                    builder.UseSetting(key, value);
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<StudioDatabaseSettings>();
                    services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(root, "studio.db")};Pooling=False"));
                });
            });
            using var first = factory.Services.CreateScope();
            using var second = factory.Services.CreateScope();
            var service = first.ServiceProvider.GetRequiredService<StudioStateService>();
            first.ServiceProvider.GetRequiredService<StudioStateService>().Should().BeSameAs(service);
            second.ServiceProvider.GetRequiredService<StudioStateService>().Should().NotBeSameAs(service);
            second.ServiceProvider.GetRequiredService<IStudioStateStore>().Should().NotBeSameAs(first.ServiceProvider.GetRequiredService<IStudioStateStore>());
            second.ServiceProvider.GetRequiredService<StudioCatalogContract>().Should().BeSameAs(first.ServiceProvider.GetRequiredService<StudioCatalogContract>());
            second.ServiceProvider.GetRequiredService<StudioStateValidator>().Should().BeSameAs(first.ServiceProvider.GetRequiredService<StudioStateValidator>());

            var state = await service.GetAsync(Guid.NewGuid(), CancellationToken.None);
            state.Revision.Should().Be(0);
            File.Exists(Path.Combine(root, "studio.db")).Should().BeTrue();
            var info = await first.ServiceProvider.GetRequiredService<ISender>().SendAsync(new GetStudioInfoQuery(), CancellationToken.None);
            info.Product.Should().Be("Ocharo Studio");
            info.Storage.Should().Be("sqlite");
            info.DocumentSchemaVersion.Should().Be(2);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(root, true);
        }
    }
}
