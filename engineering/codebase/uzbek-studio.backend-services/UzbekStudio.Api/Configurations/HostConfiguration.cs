namespace UzbekStudio.Api.Configurations;

/// <summary>Configures the UzbekStudio host — slim orchestrator that delegates to extension methods.</summary>
public static class HostConfiguration
{
    /// <summary>Configures all services across every layer.</summary>
    public static WebApplicationBuilder Configure(this WebApplicationBuilder builder)
    {
        builder
            .AddPersistenceLayer()
            .AddInfrastructureLayer()
            .AddApplicationLayer()
            .AddApiServices();

        return builder;
    }

    /// <summary>Configures the middleware pipeline and maps endpoints.</summary>
    public static WebApplication Configure(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
            app.MapOpenApi();

        // Serve the React SPA from wwwroot (single-deploy: API + UI in one host).
        app.UseDefaultFiles();
        app.UseStaticFiles();

        app.MapControllers();
        app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "UzbekStudio" }));
        app.MapFallback("/api/{**slug}", () => Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Not Found")).AllowAnonymous();
        app.MapFallbackToFile("index.html").AllowAnonymous();

        return app;
    }
}
