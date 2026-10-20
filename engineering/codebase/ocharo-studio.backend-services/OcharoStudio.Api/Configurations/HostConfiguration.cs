using OcharoStudio.Persistence;
using WoW.Two.Sdk.Beta.Be.Foundation.Configuration;
using WoW.Two.Sdk.Beta.Be.Web.ProblemDetails;

namespace OcharoStudio.Api.Configurations;

/// <summary>Extends the host builder and the web application for startup wiring.</summary>
public static partial class HostConfiguration
{
    /// <summary>Configures the application builder (services).</summary>
    public static WebApplicationBuilder Configure(this WebApplicationBuilder builder)
    {
        return builder
            .AddSettingsFiles()
            .AddIngress()
            .AddStudio()
            .AddStudioAccess()
            .AddRuntimeConfig()
            .AddControllers();
    }

    /// <summary>Runs startup tasks, then configures middleware and endpoints.</summary>
    public static async Task<WebApplication> ConfigureAsync(this WebApplication app)
    {
        await app.Services.InitializeStudioDatabaseAsync(app.Lifetime.ApplicationStopping);

        app.UseHttpProblemDetails();
        app.WarnAboutRejectedRuntimeConfig();

        return app
            .UseIngress()
            .UseApiDocumentation()
            .UseStudioAssets()
            .UseStudioAccess()
            .MapStudioEndpoints()
            .MapSpaFallback();
    }
}
