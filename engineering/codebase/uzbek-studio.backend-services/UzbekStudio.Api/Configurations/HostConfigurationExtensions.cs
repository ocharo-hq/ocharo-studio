using UzbekStudio.Application;

namespace UzbekStudio.Api.Configurations;

/// <summary>Per-concern host registration extensions for the UzbekStudio API.</summary>
public static class HostConfigurationExtensions
{
    /// <summary>Configures the application layer (kit mediator + handlers).</summary>
    public static WebApplicationBuilder AddApplicationLayer(this WebApplicationBuilder builder)
    {
        builder.Services.AddApplication();
        return builder;
    }

    /// <summary>Configures API services — controllers and OpenAPI.</summary>
    public static WebApplicationBuilder AddApiServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddControllers();
        builder.Services.AddOpenApi();
        return builder;
    }
}
