using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.Extensions.Logging.Abstractions;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Identity.Bff;

namespace OcharoStudio.Api.Configurations;

public static partial class HostConfiguration
{
    /// <summary>Registers sign-in through Ocharo's Identity instance (BFF, section <c>Identity:Client</c>, required at boot)
    /// and the Data Protection key ring that encrypts the sessions.</summary>
    /// <remarks>The BFF keeps sessions in the SDK default, the in-memory distributed cache: Studio stores in SQLite and no
    /// SQLite <c>IDistributedCache</c> exists, so a restart or deploy signs everyone out once. The key ring persists to
    /// <c>DataProtection:KeysPath</c>, else <c>keys</c> beside the SQLite database, on a deployed host's data volume.</remarks>
    private static WebApplicationBuilder AddStudioAccess(this WebApplicationBuilder builder)
    {
        builder.Services.AddIdentityBff();
        // Resolve final configuration after test/deployment overrides have been applied.
        builder.Services.AddDataProtection();
        builder.Services.AddOptions<KeyManagementOptions>().Configure<IConfiguration, StudioDatabaseSettings>((options, configuration, database) =>
        {
            var path = configuration["DataProtection:KeysPath"];
            if (string.IsNullOrWhiteSpace(path)) path = Path.Combine(database.DataDirectory ?? "appdata", "keys");
            options.XmlRepository = new FileSystemXmlRepository(new DirectoryInfo(Path.GetFullPath(path)), NullLoggerFactory.Instance);
        });
        builder.Services.AddOptions<DataProtectionOptions>().Configure<IConfiguration, IHostEnvironment>((options, configuration, environment) =>
            options.ApplicationDiscriminator = configuration["DataProtection:ApplicationName"] ?? $"ocharo-studio:{environment.EnvironmentName}");
        return builder;
    }

    /// <summary>Configures the session pipeline: HTTPS for the session routes, then the BFF (authentication, the
    /// <c>X-Csrf-Token</c> check, authorization). No fallback policy: only <c>[Authorize]</c> routes need a session, so
    /// Studio stays usable in the browser without signing in.</summary>
    private static WebApplication UseStudioAccess(this WebApplication app)
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
}
