using Microsoft.AspNetCore.StaticFiles;
using OcharoStudio.Persistence;

namespace OcharoStudio.Api.Configurations;

/// <summary>Configures the OcharoStudio host — slim orchestrator that delegates to extension methods.</summary>
public static partial class HostConfiguration
{
    /// <summary>Configures all services across every layer.</summary>
    public static WebApplicationBuilder Configure(this WebApplicationBuilder builder)
    {
        builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
        builder
            .AddStudioDatabase()
            .AddApplicationLayer()
            .AddApiServices();

        return builder;
    }

    /// <summary>Configures the middleware pipeline and maps endpoints.</summary>
    public static async Task<WebApplication> ConfigureAsync(this WebApplication app)
    {
        await app.Services.InitializeStudioDatabaseAsync(app.Lifetime.ApplicationStopping);

        if (app.Environment.IsDevelopment())
            app.MapOpenApi();

        // Serve the Vue SPA from wwwroot (single-deploy: API + UI in one host).
        app.UseDefaultFiles();
        var contentTypes = new FileExtensionContentTypeProvider();
        contentTypes.Mappings[".glb"] = "model/gltf-binary";
        contentTypes.Mappings[".gltf"] = "model/gltf+json";
        app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });

        app.UseAuthentication();
        app.UseAuthorization();
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
        app.MapFallbackToFile("index.html").AllowAnonymous();

        return app;
    }
}
