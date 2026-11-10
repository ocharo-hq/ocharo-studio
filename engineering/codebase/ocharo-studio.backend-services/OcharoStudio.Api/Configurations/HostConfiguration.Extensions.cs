using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using OcharoStudio.Api.RuntimeConfig.Settings;
using OcharoStudio.Api.Studio.Thumbnails;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure;
using OcharoStudio.Infrastructure.Studio.Services;
using OcharoStudio.Infrastructure.Studio.Validators;
using Npgsql;
using OcharoStudio.Api.Studio.Health;
using OcharoStudio.Persistence;
using OcharoStudio.Persistence.Import;
using WoW.Two.Sdk.Beta.Be.Caching.Postgres;
using WoW.Two.Sdk.Beta.Be.Data.Abstractions;
using WoW.Two.Sdk.Beta.Be.Data.EntityFrameworkCore;
using WoW.Two.Sdk.Beta.Be.Data.Migrations.Bespoke;
using WoW.Two.Sdk.Beta.Be.Files.Client;
using WoW.Two.Sdk.Beta.Be.Foundation.Options;
using WoW.Two.Sdk.Beta.Be.Identity.Bff;
using WoW.Two.Sdk.Beta.Be.Mediator;
using WoW.Two.Sdk.Beta.Be.Meta;
using WoW.Two.Sdk.Beta.Be.Web.Json;
using WoW.Two.Sdk.Beta.Be.Web.ProblemDetails;

namespace OcharoStudio.Api.Configurations;

/// <summary>Extends the host builder and the web application for startup wiring.</summary>
public static partial class HostConfiguration
{
    /// <summary>Registers the be sdk boot bundle: settings files, logging, telemetry, health, problem details, secure
    /// headers and the SPA bundle with its garment model types. Forwarded headers apply only from loopback and the ingress
    /// addresses under <c>Deployment:TrustedProxies</c>, which a deployed target supplies; the checked-in default trusts no
    /// proxy.</summary>
    /// <remarks>The long immutable cache stays off: <c>/assets</c> holds the unhashed garment models, textures and brand
    /// files beside Vite's hashed bundle, so a year-long cache would pin a changed model.</remarks>
    private static WebApplicationBuilder AddStudioDefaults(this WebApplicationBuilder builder) =>
        builder.AddApiDefaults(options =>
        {
            options.ServiceName = "OcharoStudio";
            options.TrustProxiesFrom(builder.Configuration.GetSection("Deployment"));
            options.ReadinessEndpointPath = "/health/ready";
            options.SpaHosting = spa =>
            {
                spa.ImmutableAssetsPath = string.Empty;
                spa.ContentTypes[".glb"] = "model/gltf-binary";
                spa.ContentTypes[".gltf"] = "model/gltf+json";
            };
        });

    /// <summary>Registers Studio's PostgreSQL storage in the product database (<c>ConnectionStrings:Database</c>, filled per
    /// target by Wheelhouse): the <c>studio</c> migration set, keyed into Identity's accounts and organizations, the state
    /// store, its readiness check, and the import of the retired SQLite store; then the state services and validation.</summary>
    private static WebApplicationBuilder AddStudio(this WebApplicationBuilder builder)
    {
        // The configured string, not the data source's: a data source drops the password from its own copy.
        static string ConnectionString(IServiceProvider provider) =>
            provider.GetRequiredService<IConfiguration>().GetConnectionString(StudioDatabaseConstants.ConnectionStringName)
            ?? throw new InvalidOperationException($"ConnectionStrings:{StudioDatabaseConstants.ConnectionStringName} is required.");
        builder.Services.AddSingleton(provider => NpgsqlDataSource.Create(ConnectionString(provider)));
        builder.Services.AddKeyedSingleton<IDbConnectionFactory>(StudioDatabaseConstants.MigrationSetName, static (provider, _) =>
            new DataSourceConnectionFactory(provider.GetRequiredService<NpgsqlDataSource>()));
        builder.Services.AddKeyedSingleton(StudioDatabaseConstants.MigrationSetName, static (provider, _) =>
            new DatabaseSettings { ConnectionString = ConnectionString(provider) });
        builder.Services.AddDatabaseBespokeMigrationSet(
            StudioDatabaseConstants.MigrationSetName,
            static _ => new EmbeddedResourceMigrationBroker(typeof(PostgresStudioStateStore).Assembly, StudioDatabaseConstants.MigrationResourcePrefix),
            static migration =>
            {
                migration.SchemaName = StudioDatabaseConstants.Schema;
                migration.SchemaOwner = "product";
                migration.AdvisoryLockId = StudioDatabaseConstants.AdvisoryLockId;
                migration.Version = BuildIdentity.MigrationVersion;
                migration.Release = BuildIdentity.MigrationRelease;
                migration.DependsOn(StudioDatabaseConstants.IdentitySetName, StudioDatabaseConstants.IdentityLevel);
            });
        builder.Services.AddSingleton<IStudioStateStore, PostgresStudioStateStore>();
        builder.Services.AddHealthChecks().AddCheck<StudioDatabaseReadinessCheck>("studio-database", tags: ["ready"]);

        builder.Services.AddSingleton(provider =>
            provider.GetRequiredService<IConfiguration>().GetSection(LegacySqliteSettings.SectionName).Get<LegacySqliteSettings>() ?? new LegacySqliteSettings());
        builder.Services.AddSingleton<LegacySqliteImport>();

        builder.Services.AddMediator(typeof(InfrastructureAssembly).Assembly);
        builder.AddStudioThumbnails();
        builder.Services.AddScoped<StudioStateService>();
        builder.Services.AddSingleton(StudioCatalogContract.LoadEmbedded());
        builder.Services.AddSingleton<StudioStateValidator>();
        return builder;
    }

    /// <summary>Registers sign-in through Ocharo's Identity instance (BFF, section <c>Identity:Client</c>, required at boot)
    /// and the Data Protection key ring that encrypts the sessions, both in the product database, so a restart or deploy
    /// keeps everyone signed in.</summary>
    /// <remarks>The BFF keeps sessions in <c>IDistributedCache</c>: the be sdk's PostgreSQL cache in schema
    /// <c>studio_cache</c>, apart from Desk's <c>cache</c>, its <c>distributed_cache</c> set migrating beside Studio's own.
    /// The key ring lives in <c>studio.data_protection_keys</c>.</remarks>
    private static WebApplicationBuilder AddStudioAccess(this WebApplicationBuilder builder)
    {
        builder.Services.AddIdentityBff();
        builder.Services.AddPostgresDistributedCache(options =>
        {
            options.ConnectionString = builder.Configuration.GetConnectionString(StudioDatabaseConstants.ConnectionStringName) ?? string.Empty;
            options.Schema = StudioDatabaseConstants.CacheSchema;
        });
        builder.Services.AddDataProtection();
        builder.Services.AddOptions<KeyManagementOptions>().Configure<NpgsqlDataSource>((options, dataSource) =>
            options.XmlRepository = new PostgresXmlRepository(dataSource));
        builder.Services.AddOptions<DataProtectionOptions>().Configure<IConfiguration, IHostEnvironment>((options, configuration, environment) =>
            options.ApplicationDiscriminator = configuration["DataProtection:ApplicationName"] ?? $"ocharo-studio:{environment.EnvironmentName}");
        return builder;
    }

    /// <summary>Holds the root URL of the WoW2 Files instance Studio stores saved-look thumbnails in; unset, they stay data
    /// URLs inside the state.</summary>
    private const string FilesBaseUrlKey = "Files:BaseUrl";

    /// <summary>Registers the thumbnail store: WoW2 Files over HTTP when <see cref="FilesBaseUrlKey"/> is set, by tokens of
    /// Studio's own Identity client exchanged for the signed-in person (the BFF session), else none. Read at resolve time,
    /// so a test host's settings decide (research/files-adoption.md #12).</summary>
    private static WebApplicationBuilder AddStudioThumbnails(this WebApplicationBuilder builder)
    {
        builder.Services.AddFilesClient(_ => { });
        builder.Services.AddOptions<FilesClientOptions>().Configure<IConfiguration>((files, configuration) =>
        {
            if (configuration[FilesBaseUrlKey] is not { Length: > 0 } url)
                return;
            files.BaseAddress = new Uri(url);
            if (!Uri.TryCreate(configuration["Identity:Client:Authority"], UriKind.Absolute, out var authority))
                return;
            files.Identity = new FilesClientIdentityOptions
            {
                TokenEndpoint = new Uri(authority, "connect/token"),
                ClientId = configuration["Identity:Client:ClientId"] ?? string.Empty,
                ClientSecret = configuration["Identity:Client:ClientSecret"] ?? string.Empty,
            };
        });
        builder.Services.AddScoped<FilesStudioThumbnailStore>();
        builder.Services.AddSingleton<DisabledStudioThumbnailStore>();
        builder.Services.AddScoped<IStudioThumbnailStore>(provider =>
            provider.GetRequiredService<IConfiguration>()[FilesBaseUrlKey] is { Length: > 0 }
                ? provider.GetRequiredService<FilesStudioThumbnailStore>()
                : provider.GetRequiredService<DisabledStudioThumbnailStore>());
        return builder;
    }

    /// <summary>Registers the public runtime settings the SPA reads at startup: the Ocharo app and site addresses.</summary>
    private static WebApplicationBuilder AddRuntimeConfig(this WebApplicationBuilder builder)
    {
        // Every address is optional, and a malformed one is left out rather than failing the host over a menu link.
        builder.Services.AddValidatedSettings<OcharoAppsSettings>(builder.Configuration, OcharoAppsSettings.SectionName, _ => { });
        return builder;
    }

    /// <summary>Warns once about each configured app address the runtime config leaves out.</summary>
    private static void WarnAboutRejectedRuntimeConfig(this WebApplication app)
    {
        var rejected = app.Services.GetRequiredService<OcharoAppsSettings>().RejectedSettings();
        if (rejected.Count > 0)
            app.Logger.LogWarning("Runtime config leaves out {Settings}: each must be a plain HTTPS address.", string.Join(", ", rejected));
    }

    /// <summary>Registers the controllers on the be sdk JSON contract and the full HTTP problem boundary: status pages,
    /// MVC error-result normalization and <c>no-store</c> on every error, whatever the client accepts.</summary>
    private static WebApplicationBuilder AddControllers(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpProblemDetails();
        builder.Services.AddControllersWithSdkJson();
        return builder;
    }

    /// <summary>Configures the session pipeline inside the boot bundle, after routing: HTTPS for the session routes, then
    /// the BFF (authentication, the <c>X-Csrf-Token</c> check, authorization). No fallback policy: only <c>[Authorize]</c>
    /// routes need a session, so Studio stays usable in the browser without signing in.</summary>
    private static IApplicationBuilder UseStudioAccess(this IApplicationBuilder app)
    {
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api/identity") && !context.Request.IsHttps)
            {
                await Results.Problem(statusCode: 400, title: "HTTPS is required",
                    extensions: new Dictionary<string, object?> { ["code"] = "https_required" }).ExecuteAsync(context);
                return;
            }
            await next(context);
        });
        app.UseIdentityBff();
        return app;
    }

    /// <summary>Configures controllers and the Identity session routes; the boot bundle maps health, the API 404 and the
    /// SPA fallback.</summary>
    private static WebApplication MapStudioEndpoints(this WebApplication app)
    {
        app.MapControllers();
        app.MapIdentityBffEndpoints();
        return app;
    }
}
