using WoW.Two.Sdk.Backend.Beta.Web.ErrorMapping;
using UzbekStudio.Application;
using UzbekStudio.Infrastructure;
using UzbekStudio.Persistence;

namespace UzbekStudio.Api.Configurations;

/// <summary>Per-concern host registration extensions for the UzbekStudio API.</summary>
public static class HostConfigurationExtensions
{
    /// <summary>Configures the persistence layer (EF Core SQLite context).</summary>
    public static WebApplicationBuilder AddPersistenceLayer(this WebApplicationBuilder builder)
    {
        builder.Services.AddPersistence(builder.Configuration);
        return builder;
    }

    /// <summary>Configures the infrastructure layer (clock and other abstraction implementations).</summary>
    public static WebApplicationBuilder AddInfrastructureLayer(this WebApplicationBuilder builder)
    {
        builder.Services.AddInfrastructure();
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
        builder.Services.AddControllers();
        builder.Services.AddErrorHttpStatusMapping();
        builder.Services.AddOpenApi();
        return builder;
    }
}
