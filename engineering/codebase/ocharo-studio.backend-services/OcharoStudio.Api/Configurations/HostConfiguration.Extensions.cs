using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.StaticFiles;
using OcharoStudio.Api.Studio.Access;
using OcharoStudio.Application;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence;
using WoW.Two.Sdk.Backend.Beta.Mediator;
using WoW.Two.Sdk.Backend.Beta.Web.ProblemDetails;

namespace OcharoStudio.Api.Configurations;

/// <summary>Extends the host builder and the web application for startup wiring.</summary>
public static partial class HostConfiguration
{
    /// <summary>Configures optional local settings before registering product concerns.</summary>
    private static WebApplicationBuilder AddConfiguration(this WebApplicationBuilder builder)
    {
        builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
        return builder;
    }

    /// <summary>Registers Studio state storage, document capabilities, services and validation.</summary>
    private static WebApplicationBuilder AddStudio(this WebApplicationBuilder builder)
    {
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION")
            ?? builder.Configuration.GetConnectionString("Studio")
            ?? "Data Source=appdata/ocharo-studio.db;Cache=Shared;Default Timeout=5";

        builder.Services.AddSingleton(new StudioDatabaseSettings(connectionString));
        builder.Services.AddScoped<IStudioStateStore, SqliteStudioStateStore>();
        builder.Services.AddMediator(typeof(ApplicationAssembly).Assembly);
        builder.Services.AddScoped<StudioStateService>();
        builder.Services.AddSingleton(StudioCatalogContract.LoadEmbedded());
        builder.Services.AddSingleton<StudioStateValidator>();
        return builder;
    }

    /// <summary>Registers the Desk access client and Studio authentication and authorization.</summary>
    private static WebApplicationBuilder AddStudioAccess(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient<StudioAccessClient>(client => client.Timeout = TimeSpan.FromSeconds(5))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddAuthentication(StudioIntegrationAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, StudioIntegrationAuthenticationHandler>(
                StudioIntegrationAuthenticationHandler.SchemeName, _ => { });
        builder.Services.AddAuthorization();
        return builder;
    }

    /// <summary>Registers the HTTP boundary, controllers and OpenAPI documentation.</summary>
    private static WebApplicationBuilder AddControllers(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpProblemDetails();
        builder.Services.AddControllers();
        builder.Services.AddOpenApi();
        return builder;
    }

    /// <summary>Configures development-only API documentation.</summary>
    private static WebApplication UseApiDocumentation(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
            app.MapOpenApi();
        return app;
    }

    /// <summary>Configures SPA assets and garment model content types.</summary>
    private static WebApplication UseStudioAssets(this WebApplication app)
    {
        app.UseDefaultFiles();
        var contentTypes = new FileExtensionContentTypeProvider();
        contentTypes.Mappings[".glb"] = "model/gltf-binary";
        contentTypes.Mappings[".gltf"] = "model/gltf+json";
        app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });
        return app;
    }

    /// <summary>Configures Studio authentication before authorization and controller execution.</summary>
    private static WebApplication UseStudioAccess(this WebApplication app)
    {
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    /// <summary>Configures controllers, build identity, health and missing API routes.</summary>
    private static WebApplication MapStudioEndpoints(this WebApplication app)
    {
        app.MapControllers();
        app.MapGet("/api/system/version", (HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new { service = "OcharoStudio", version = BuildIdentity.Version });
        }).AllowAnonymous();
        app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "OcharoStudio" }));
        app.MapFallback("/api/{**slug}", () => Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Not Found")).AllowAnonymous();
        return app;
    }

    /// <summary>Configures anonymous SPA navigation after API route mapping.</summary>
    private static WebApplication MapSpaFallback(this WebApplication app)
    {
        app.MapFallbackToFile("index.html").AllowAnonymous();
        return app;
    }
}
