using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Mediator;
using Xunit;

namespace OcharoStudio.Tests;

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
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<StudioDatabaseSettings>();
                    services.AddSingleton(new StudioDatabaseSettings($"Data Source={Path.Combine(root, "studio.db")};Pooling=False"));
                });
            });
            using var first = factory.Services.CreateScope();
            using var second = factory.Services.CreateScope();
            var service = first.ServiceProvider.GetRequiredService<StudioStateService>();
            Assert.Same(service, first.ServiceProvider.GetRequiredService<StudioStateService>());
            Assert.NotSame(service, second.ServiceProvider.GetRequiredService<StudioStateService>());
            Assert.NotSame(first.ServiceProvider.GetRequiredService<IStudioStateStore>(), second.ServiceProvider.GetRequiredService<IStudioStateStore>());
            Assert.Same(first.ServiceProvider.GetRequiredService<StudioCatalogContract>(), second.ServiceProvider.GetRequiredService<StudioCatalogContract>());
            Assert.Same(first.ServiceProvider.GetRequiredService<StudioStateValidator>(), second.ServiceProvider.GetRequiredService<StudioStateValidator>());

            var state = await service.GetAsync(Guid.NewGuid(), CancellationToken.None);
            Assert.Equal(0, state.Revision);
            Assert.True(File.Exists(Path.Combine(root, "studio.db")));
            var info = await first.ServiceProvider.GetRequiredService<ISender>().SendAsync(new GetStudioInfoQuery(), CancellationToken.None);
            Assert.Equal("Ocharo Studio", info.Product);
            Assert.Equal("sqlite", info.Storage);
            Assert.Equal(2, info.DocumentSchemaVersion);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(root, true);
        }
    }
}
