using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using OcharoStudio.Persistence;
using Testcontainers.PostgreSql;
using WoW.Two.Sdk.Beta.Be.Caching.Postgres;
using WoW.Two.Sdk.Beta.Be.Data.Abstractions;
using WoW.Two.Sdk.Beta.Be.Data.EntityFrameworkCore;
using WoW.Two.Sdk.Beta.Be.Data.Migrations.Bespoke;
using WoW.Two.Sdk.Beta.Be.Foundation.Results;

namespace OcharoStudio.Tests.Support;

/// <summary>One PostgreSQL container per test run, and a fresh product database per test, copied from a template that
/// already holds Identity's published tables (a stand-in set), Studio's <c>studio</c> set and its session cache.</summary>
/// <remarks>A test host must claim the schemas as <see cref="OwnerInstance"/>, the instance the template applied them under.</remarks>
public static class StudioTestDatabase
{
    /// <summary>The <c>Migrations:OwnerInstance</c> every test host and the template use.</summary>
    public const string OwnerInstance = "ocharo-studio@test";

    /// <summary>Identity organizations and accounts the template holds, so a workspace may key into them.</summary>
    public static readonly IReadOnlyList<Guid> Organizations =
    [
        Guid.Parse("7c1e4b2a-9d3f-4e6a-8b5c-2f1a0d9e8c7b"),
        Guid.Parse("1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f"),
        Guid.Parse("11111111-1111-1111-1111-111111111111"),
    ];

    /// <inheritdoc cref="Organizations"/>
    public static readonly IReadOnlyList<Guid> Users =
    [
        Guid.Parse("22222222-2222-2222-2222-222222222222"),
        Guid.Parse("33333333-3333-3333-3333-333333333333"),
    ];

    private const string Template = "studio_template";
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static PostgreSqlContainer? _container;

    /// <summary>Creates an empty product database from the template and returns its connection string.</summary>
    public static async Task<string> CreateAsync()
    {
        var admin = await EnsureTemplateAsync();
        var name = "studio_" + Guid.NewGuid().ToString("N");
        await using (var connection = new NpgsqlConnection(admin))
        {
            await connection.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE {name} TEMPLATE {Template}", connection);
            await create.ExecuteNonQueryAsync();
        }

        return new NpgsqlConnectionStringBuilder(admin) { Database = name }.ConnectionString;
    }

    /// <summary>Registers Studio's set as the host does, for a test that applies or inspects it without a host.</summary>
    public static IServiceCollection AddStudioSets(this IServiceCollection services, string connectionString, bool withIdentityStub)
    {
        var dataSource = NpgsqlDataSource.Create(connectionString);
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [MigrationConstants.OwnerInstanceConfigurationKey] = OwnerInstance })
            .Build());
        services.AddSingleton(dataSource);
        foreach (var set in withIdentityStub ? new[] { StudioDatabaseConstants.MigrationSetName, StudioDatabaseConstants.IdentitySetName } : [StudioDatabaseConstants.MigrationSetName])
        {
            services.AddKeyedSingleton<IDbConnectionFactory>(set, (_, _) => new DataSourceConnectionFactory(dataSource));
            services.AddKeyedSingleton(set, (_, _) => new DatabaseSettings { ConnectionString = connectionString });
        }

        if (withIdentityStub)
        {
            services.AddDatabaseBespokeMigrationSet(StudioDatabaseConstants.IdentitySetName,
                Path.Combine(AppContext.BaseDirectory, "IdentityStub"), migration =>
                {
                    migration.SchemaName = "identity";
                    migration.SchemaOwner = "module";
                });
        }

        services.AddDatabaseBespokeMigrationSet(
            StudioDatabaseConstants.MigrationSetName,
            _ => new EmbeddedResourceMigrationBroker(typeof(PostgresStudioStateStore).Assembly, StudioDatabaseConstants.MigrationResourcePrefix),
            migration =>
            {
                migration.SchemaName = StudioDatabaseConstants.Schema;
                migration.SchemaOwner = "product";
                migration.AdvisoryLockId = StudioDatabaseConstants.AdvisoryLockId;
                migration.Release = "0.0.0";
                migration.DependsOn(StudioDatabaseConstants.IdentitySetName, StudioDatabaseConstants.IdentityLevel);
            });
        services.AddPostgresDistributedCache(options =>
        {
            options.ConnectionString = connectionString;
            options.Schema = StudioDatabaseConstants.CacheSchema;
        });
        return services;
    }

    /// <summary>Brings an existing database to what a deployed Studio finds: Identity's published tables (a stand-in set
    /// holding <see cref="Organizations"/> and <see cref="Users"/>), Studio's <c>studio</c> set and its session cache.</summary>
    /// <remarks>Idempotent: a rerun applies nothing and inserts no row twice.</remarks>
    public static async Task PrepareAsync(string connectionString)
    {
        await using (var provider = new ServiceCollection().AddLogging().AddStudioSets(connectionString, withIdentityStub: true).BuildServiceProvider())
        {
            var applied = await provider.ApplyMigrationSetsAsync("test");
            if (applied.IsFailure(out var error, out _))
                throw new InvalidOperationException($"The test database did not migrate: {error.Message}");
        }

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        foreach (var organization in Organizations)
        {
            await using var insert = new NpgsqlCommand(
                "INSERT INTO identity.identity_organizations (id, name) VALUES ($1, 'Ocharo') ON CONFLICT (id) DO NOTHING", connection);
            insert.Parameters.AddWithValue(organization);
            await insert.ExecuteNonQueryAsync();
        }

        foreach (var user in Users)
        {
            await using var insert = new NpgsqlCommand("INSERT INTO identity.identity_users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", connection);
            insert.Parameters.AddWithValue(user);
            await insert.ExecuteNonQueryAsync();
        }
    }

    private static async Task<string> EnsureTemplateAsync()
    {
        await Gate.WaitAsync();
        try
        {
            if (_container is not null) return _container.GetConnectionString();

            var container = new PostgreSqlBuilder().WithImage("postgres:18-alpine").Build();
            await container.StartAsync();
            var admin = container.GetConnectionString();
            await using (var connection = new NpgsqlConnection(admin))
            {
                await connection.OpenAsync();
                await using var create = new NpgsqlCommand($"CREATE DATABASE {Template}", connection);
                await create.ExecuteNonQueryAsync();
            }

            await PrepareAsync(new NpgsqlConnectionStringBuilder(admin) { Database = Template, Pooling = false }.ConnectionString);
            NpgsqlConnection.ClearAllPools();
            _container = container;
            return admin;
        }
        finally
        {
            Gate.Release();
        }
    }
}
