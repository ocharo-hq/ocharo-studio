using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Ocharo.Sso;

public static class SsoContext
{
    public const string AuthenticationType = "OcharoSso";
    public const string ActorKey = "Ocharo.Sso.Actor";
    public const string TicketKey = "Ocharo.Sso.Ticket";
}


/// <summary>Server-only, explicitly enabled Desk client configuration. Origins never come from request headers.</summary>
public sealed class SsoOptions
{
    public bool Enabled { get; set; }
    public string DeskOrigin { get; set; } = "";
    public string ClientOrigin { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public Guid OrganizationId { get; set; }
    internal string AppId { get; set; } = "";
    internal string Audience { get; set; } = "";
    internal bool RequireBoundOrganization { get; set; }
    internal string CookieName => "__Host-ocharo-" + AppId;
    internal string CorrelationCookie => CookieName + "-correlation";
    internal string Callback => ClientOrigin.TrimEnd('/') + "/api/sso/callback";
    internal bool Valid => !Enabled || (Origin(DeskOrigin) && Origin(ClientOrigin) &&
        System.Text.RegularExpressions.Regex.IsMatch(ClientId, "^[a-zA-Z0-9-]{1,80}$") && ClientSecret is { Length: >=32 and <=512 } &&
        (!RequireBoundOrganization || OrganizationId != Guid.Empty));
    private static bool Origin(string value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.AbsolutePath == "/" &&
            uri.UserInfo.Length == 0 && uri.Query.Length == 0 && uri.Fragment.Length == 0;
    }
    internal bool MatchesHost(HttpRequest request)
    {
        return request.IsHttps && string.Equals(ClientOrigin.TrimEnd('/'), $"https://{request.Host}", StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>Live Desk authority for one request. DisplayName and Email are the operator's current Desk profile;
/// each is null when an older Desk omits it or its value is blank, oversized or contains control characters.</summary>
public sealed record SsoActor(bool Active, string UserId, Guid OrganizationId, string? Role, bool CanEdit, bool CanApprove, DateTimeOffset ExpiresAt,
    string? DisplayName = null, string? Email = null)
{
    public string? DisplayName { get; init; } = Displayable(DisplayName, 200);
    public string? Email { get; init; } = Displayable(Email, 256);
    private static string? Displayable(string? value, int maximum)
    {
        var text = value?.Trim();
        return string.IsNullOrEmpty(text) || text.Length > maximum || text.Any(char.IsControl) ? null : text;
    }
    internal bool Valid(SsoOptions options, DateTimeOffset now)
    {
        return Active && !string.IsNullOrWhiteSpace(UserId) && UserId.Length <= 200 && OrganizationId != Guid.Empty && ExpiresAt > now &&
            (options.OrganizationId == Guid.Empty || OrganizationId == options.OrganizationId);
    }
    public ClaimsPrincipal Principal()
    {
        var workspace = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes($"ocharo-studio/v1\n{OrganizationId:D}\n{UserId}")).AsSpan(0,16));
        return new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, UserId), new Claim(ClaimTypes.Role, Role ?? ""),
            new Claim("ocharo:organization", OrganizationId.ToString("D")), new Claim("ocharo:workspace", workspace.ToString("D")),
            new Claim("ocharo:can-edit", CanEdit ? "true" : "false"), new Claim("ocharo:can-approve", CanApprove ? "true" : "false"),
            new Claim("ocharo:expires-at", ExpiresAt.ToString("O"))], SsoContext.AuthenticationType));
    }
}

internal sealed record SsoGrant(string Ticket, DateTimeOffset ExpiresAt, string RefreshToken, DateTimeOffset SessionExpiresAt);
internal sealed record SsoEnvelope<T>(T? Data);
