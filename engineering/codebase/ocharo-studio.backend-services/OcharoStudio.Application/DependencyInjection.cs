using Microsoft.Extensions.DependencyInjection;
using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Backend.Beta.Mediator;

namespace OcharoStudio.Application;

/// <summary>Registers application-layer services — the kit mediator and its query/command handlers.</summary>
public static class DependencyInjection
{
    /// <summary>Adds the mediator and scans this assembly for <c>IRequestHandler</c> implementations.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediator(typeof(DependencyInjection).Assembly);
        services.AddScoped<StudioStateService>();
        services.AddSingleton(StudioCatalogContract.LoadEmbedded());
        services.AddSingleton<StudioStateValidator>();
        return services;
    }
}
