using Microsoft.AspNetCore.Authentication;
using OcharoStudio.Api.Studio.Access;
using OcharoStudio.Application;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;

namespace OcharoStudio.Api.Configurations;

/// <summary>Per-concern host registration extensions for the OcharoStudio API.</summary>
public static partial class HostConfiguration
{
    private static WebApplicationBuilder AddStudioDatabase(this WebApplicationBuilder builder)
    {
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION")
            ?? builder.Configuration.GetConnectionString("Studio")
            ?? "Data Source=appdata/ocharo-studio.db;Cache=Shared;Default Timeout=5";

        builder.Services.AddSingleton(new StudioDatabaseSettings(connectionString));
        builder.Services.AddScoped<IStudioStateStore, SqliteStudioStateStore>();
        return builder;
    }

    /// <summary>Configures the application layer (kit mediator + handlers).</summary>
    public static WebApplicationBuilder AddApplicationLayer(this WebApplicationBuilder builder)
    {
        builder.Services.AddApplication();
        return builder;
    }

    /// <summary>Configures API services — controllers and OpenAPI.</summary>
    public static WebApplicationBuilder AddApiServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient<StudioAccessClient>(client => client.Timeout = TimeSpan.FromSeconds(5))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddAuthentication(StudioIntegrationAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, StudioIntegrationAuthenticationHandler>(
                StudioIntegrationAuthenticationHandler.SchemeName, _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddControllers();
        builder.Services.AddOpenApi();
        return builder;
    }
}
