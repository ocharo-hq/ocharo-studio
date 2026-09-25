using Microsoft.Extensions.DependencyInjection;
using UzbekStudio.Application.Abstractions;
using UzbekStudio.Infrastructure.Time;

namespace UzbekStudio.Infrastructure;

/// <summary>Registers the infrastructure layer — implementations of the application's abstractions.</summary>
public static class DependencyInjection
{
    /// <summary>Adds the system clock (and other infrastructure services as the product grows).</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<IClock, SystemClock>();
        return services;
    }
}
