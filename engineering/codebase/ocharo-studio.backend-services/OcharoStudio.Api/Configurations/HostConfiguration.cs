using WoW.Two.Sdk.Beta.Be.Data;
using WoW.Two.Sdk.Beta.Be.Meta;

namespace OcharoStudio.Api.Configurations;

/// <summary>Extends the host builder and the web application for startup wiring.</summary>
public static partial class HostConfiguration
{
    /// <summary>Configures the application builder (services).</summary>
    public static WebApplicationBuilder Configure(this WebApplicationBuilder builder)
    {
        return builder
            .AddStudioDefaults()
            .AddStudio()
            .AddStudioAccess()
            .AddRuntimeConfig()
            .AddControllers();
    }

    /// <summary>Runs startup tasks, then configures middleware and endpoints.</summary>
    public static async Task ConfigureAsync(this WebApplication app)
    {
        // A local run applies every set at boot; a deployed boot only verifies the levels the migrate step applied.
        await app.Services.MigrateBespokeOnStartupAsync(app.Lifetime.ApplicationStopping);
        app.WarnAboutRejectedRuntimeConfig();

        app.UseApiDefaults(pipeline => pipeline.UseStudioAccess())
            .MapStudioEndpoints();
    }
}
