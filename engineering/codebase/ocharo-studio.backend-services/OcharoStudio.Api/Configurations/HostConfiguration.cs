using OcharoStudio.Persistence;

namespace OcharoStudio.Api.Configurations;

/// <summary>Extends the host builder and the web application for startup wiring.</summary>
public static partial class HostConfiguration
{
    /// <summary>Configures the application builder (services).</summary>
    public static WebApplicationBuilder Configure(this WebApplicationBuilder builder)
    {
        return builder
            .AddConfiguration()
            .AddStudio()
            .AddStudioAccess()
            .AddControllers();
    }

    /// <summary>Runs startup tasks, then configures middleware and endpoints.</summary>
    public static async Task<WebApplication> ConfigureAsync(this WebApplication app)
    {
        await app.Services.InitializeStudioDatabaseAsync(app.Lifetime.ApplicationStopping);


        return app
            .UseApiDocumentation()
            .UseStudioAssets()
            .UseStudioAccess()
            .MapStudioEndpoints()
            .MapSpaFallback();
    }
}
