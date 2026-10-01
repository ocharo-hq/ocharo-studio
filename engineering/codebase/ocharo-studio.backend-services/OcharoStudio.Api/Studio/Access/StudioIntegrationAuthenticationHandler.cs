using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace OcharoStudio.Api.Studio.Access;

/// <summary>Rechecks short-lived, audience-bound Ocharo Desk tickets on each protected request.</summary>
public sealed class StudioIntegrationAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    StudioAccessClient access) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "OcharoStudioIntegration";
    public const string WorkspaceClaim = "ocharo:workspace";
    public const string OrganizationClaim = "ocharo:organization";
    public const string EditClaim = "ocharo:can-edit";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return AuthenticateResult.NoResult();
        if (!Request.IsHttps) return AuthenticateResult.Fail("A secure connection is required.");
        var token = header[7..].Trim();
        if (token.Length is < 1 or > 8192) return AuthenticateResult.Fail("Invalid integration ticket.");
        var actor = await access.IntrospectAsync(token, Context.RequestAborted);
        if (actor is null) return AuthenticateResult.Fail("The Desk connection expired or access was revoked.");
        var workspace = WorkspaceFor(actor.OrganizationId, actor.UserId);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, actor.UserId),
            new Claim(OrganizationClaim, actor.OrganizationId.ToString("D")),
            new Claim(WorkspaceClaim, workspace.ToString("D")),
            new Claim(EditClaim, actor.CanEdit ? "true" : "false"),
            new Claim("ocharo:expires-at", actor.ExpiresAt.ToString("O"))
        };
        return AuthenticateResult.Success(new AuthenticationTicket(
            new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName)), SchemeName));
    }

    /// <summary>Separates each member's designs inside their authorized organization.</summary>
    public static Guid WorkspaceFor(Guid organizationId, string userId) => new(
        SHA256.HashData(Encoding.UTF8.GetBytes($"ocharo-studio/v1\n{organizationId:D}\n{userId}")).AsSpan(0, 16));
}

/// <summary>Uses a configured Desk origin; callers cannot select the introspection destination.</summary>
public sealed class StudioAccessClient(HttpClient client, IConfiguration configuration)
{
    public async Task<StudioActor?> IntrospectAsync(string token, CancellationToken ct)
    {
        var configured = configuration["OcharoPlatform:BaseUrl"];
        if (!Uri.TryCreate(configured, UriKind.Absolute, out var origin) ||
            origin.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(origin.UserInfo) ||
            !string.IsNullOrEmpty(origin.Query) || !string.IsNullOrEmpty(origin.Fragment)) return null;
        try
        {
            using var response = await client.PostAsJsonAsync(new Uri(origin, "/api/integrations/introspect"),
                new { token, audience = "ocharo-studio" }, ct);
            if (!response.IsSuccessStatusCode) return null;
            var envelope = await response.Content.ReadFromJsonAsync<StudioActorEnvelope>(cancellationToken: ct);
            var actor = envelope?.Data;
            return actor is { Active: true } && actor.OrganizationId != Guid.Empty &&
                !string.IsNullOrWhiteSpace(actor.UserId) && actor.UserId.Length <= 200 &&
                actor.ExpiresAt > DateTimeOffset.UtcNow ? actor : null;
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or TaskCanceledException)
        {
            return null;
        }
    }

    private sealed record StudioActorEnvelope(StudioActor? Data);
}

public sealed record StudioActor(bool Active, string UserId, Guid OrganizationId, bool CanEdit, DateTimeOffset ExpiresAt);
