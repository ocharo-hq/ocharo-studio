using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ocharo.Sso;

public static class SsoRegistration
{
    public static IServiceCollection AddOcharoSso(this IServiceCollection services, IConfiguration configuration,
        string appId, string audience, bool requireBoundOrganization = false)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(appId, "^[a-z0-9-]{1,40}$")) throw new ArgumentException("Invalid application id", nameof(appId));
        services.AddSingleton(provider =>
        {
            var options = (provider.GetService<IConfiguration>() ?? configuration).GetSection("Identity:Sso").Get<SsoOptions>() ?? new();
            options.AppId = appId;
            options.Audience = audience;
            options.RequireBoundOrganization = requireBoundOrganization;
            if (!options.Valid) throw new InvalidOperationException("Enabled SSO requires fixed HTTPS origins, client credentials and a bound organization where required.");
            return options;
        });
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<SsoSessionStore>();
        services.AddHttpClient<SsoBackchannel>(client => client.Timeout = TimeSpan.FromSeconds(5)).RemoveAllLoggers()
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });
        return services;
    }
    public static IApplicationBuilder UseOcharoSso(this IApplicationBuilder app, Func<HttpContext,bool>? isPublic = null, Func<HttpContext,bool>? resolveSession = null)
    {
        _ = app.ApplicationServices.GetRequiredService<SsoOptions>();
        return app.UseMiddleware<SsoMiddleware>(new SsoRouting(isPublic ?? (_ => false), resolveSession ?? (_ => false)));
    }
}

public sealed record SsoRouting(Func<HttpContext,bool> IsPublic, Func<HttpContext,bool> ResolveSession);
