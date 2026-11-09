using System.Globalization;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WoW.Two.Sdk.Beta.Be.Identity.Bff;
using WoW.Two.Sdk.Beta.Be.Identity.Core.Organizations;

using OcharoStudio.Tests.Support;
using WoW.Two.Sdk.Beta.Be.Data.Migrations.Bespoke;

namespace OcharoStudio.Tests.E2E;

/// <summary>
/// What the Studio test hosts replace for sign-in: a stand-in for the Identity BFF cookie scheme. A request whose session
/// cookie (<see cref="CookieName"/>) names one of the <see cref="People"/> is signed in with the claims Identity's token
/// carries and a session reference, so the BFF's real <c>X-Csrf-Token</c> check holds as for a real session; any other
/// request is anonymous. No call reaches the Identity instance.
/// </summary>
internal static class StudioTestIdentity
{
    /// <summary>The session cookie's name in the test hosts.</summary>
    public const string CookieName = "__Host-ocharo-studio";

    /// <summary>The organization most test people belong to.</summary>
    public static readonly Guid Organization = Guid.Parse("7c1e4b2a-9d3f-4e6a-8b5c-2f1a0d9e8c7b");

    /// <summary>A second organization: Studio serves any organization, so its members are members too.</summary>
    public static readonly Guid OtherOrganization = Guid.Parse("1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f");

    /// <summary>A signed-in person, named by the session cookie's <paramref name="Key"/>. <paramref name="OrganizationId"/> is
    /// the active organization, null for none; <paramref name="RoleOrganizationId"/> is where the role and its permissions
    /// sit, the active organization unless set.</summary>
    public sealed record Person(string Key, string Subject, Guid? OrganizationId, string? Role, Guid? RoleOrganizationId = null);

    public static readonly Person Editor = new("editor", "editor-sub", Organization, "editor");
    public static readonly Person SecondEditor = new("second-editor", "second-editor-sub", Organization, "editor");
    public static readonly Person EditorElsewhere = new("editor-elsewhere", "editor-sub", OtherOrganization, "editor");
    public static readonly Person Viewer = new("viewer", "viewer-sub", Organization, "viewer");
    public static readonly Person Pinned = new("pinned", "22222222-2222-2222-2222-222222222222", Guid.Parse("11111111-1111-1111-1111-111111111111"), "editor");
    public static readonly Person Unaffiliated = new("unaffiliated", "unaffiliated-sub", null, null);
    public static readonly Person RoleLess = new("role-less", "role-less-sub", Organization, null);
    public static readonly Person RoleElsewhere = new("role-elsewhere", "role-elsewhere-sub", Organization, "editor", OtherOrganization);

    private static readonly Dictionary<string, Person> People = new[] { Editor, SecondEditor, EditorElsewhere, Viewer, Pinned, Unaffiliated, RoleLess, RoleElsewhere }
        .ToDictionary(person => person.Key, StringComparer.Ordinal);

    /// <summary>Settings that satisfy <c>Identity:Client</c> validation without any network call to the authority, and a
    /// fresh product database per call, migrated as the deploy step leaves it.</summary>
    public static Dictionary<string, string?> Settings() => new()
    {
        ["Identity:Client:Authority"] = "https://identity.example.test/",
        ["Identity:Client:ClientId"] = "studio",
        ["Identity:Client:CookieName"] = CookieName,
        ["ConnectionStrings:Database"] = StudioTestDatabase.CreateAsync().GetAwaiter().GetResult(),
        [MigrationConstants.OwnerInstanceConfigurationKey] = StudioTestDatabase.OwnerInstance,
    };

    /// <summary>Replaces the BFF cookie scheme's handler with the cookie-driven test handler.</summary>
    public static void Use(IServiceCollection services)
    {
        services.PostConfigure<AuthenticationOptions>(options =>
        {
            foreach (var scheme in options.Schemes.Where(scheme => scheme.Name == BffAuthenticationSchemeConstants.Cookie))
                scheme.HandlerType = typeof(Handler);
        });
    }

    /// <summary>A client that stays anonymous.</summary>
    public static HttpClient Anonymous(WebApplicationFactory<Program> factory, string baseAddress = "https://localhost") =>
        factory.CreateClient(new WebApplicationFactoryClientOptions
        { BaseAddress = new Uri(baseAddress), HandleCookies = false, AllowAutoRedirect = false });

    /// <summary>A client over HTTPS carrying <paramref name="person"/>'s session cookie; with <paramref name="csrf"/> it sends
    /// the session's <c>X-Csrf-Token</c>, read from the session route as the SPA does, on every request.</summary>
    public static async Task<HttpClient> SignedIn(WebApplicationFactory<Program> factory, Person person, bool csrf = true)
    {
        var client = Anonymous(factory);
        client.DefaultRequestHeaders.Add("Cookie", $"{CookieName}={person.Key}");
        if (csrf)
            client.DefaultRequestHeaders.Add("X-Csrf-Token", (await IdentitySessionAsync(client)).GetProperty("csrfToken").GetString());
        return client;
    }

    /// <summary>The BFF session route's <c>data</c>.</summary>
    public static async Task<JsonElement> IdentitySessionAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<JsonElement>("/api/identity/session")).GetProperty("data");

    /// <summary>The principal Identity's token gives <paramref name="person"/>.</summary>
    private static ClaimsPrincipal Principal(Person person, string authenticationType)
    {
        var claims = new List<Claim> { new("sub", person.Subject), new("sid", "sid-" + person.Key), new("name", person.Key), new("email", person.Key + "@example.test") };
        if (person.OrganizationId is { } organization)
        {
            claims.Add(new Claim(OrganizationClaimTypeConstants.Id, organization.ToString("D", CultureInfo.InvariantCulture)));
            claims.Add(new Claim(OrganizationClaimTypeConstants.Name, "Ocharo"));
            claims.Add(new Claim(OrganizationClaimTypeConstants.Slug, "ocharo"));
            if (person.Role is { } role)
            {
                var id = (person.RoleOrganizationId ?? organization).ToString("D", CultureInfo.InvariantCulture);
                claims.Add(new Claim(OrganizationClaimTypeConstants.Role, $"{id}:{role}"));
                claims.AddRange(Permissions(role).Select(permission => new Claim(OrganizationClaimTypeConstants.Permission, $"{id}:{permission}")));
            }
        }
        return new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType, "name", "role"));
    }

    /// <summary>The permissions the deployed Identity grants a role: owner, admin and editor edit, viewer reads.</summary>
    private static string[] Permissions(string role) => role switch
    {
        "owner" or "admin" or "editor" => ["studio:edit"],
        _ => [],
    };

    private sealed class Handler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Cookies.TryGetValue(CookieName, out var key) || !People.TryGetValue(key, out var person))
                return Task.FromResult(AuthenticateResult.NoResult());
            // The BFF's session reference (`.bff.sid`, `.bff.ref`): the session route then issues a CSRF token bound to it,
            // and the antiforgery check demands it on unsafe API requests.
            var properties = new AuthenticationProperties { ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1) };
            properties.Items[".bff.sid"] = "sid-" + person.Key;
            properties.Items[".bff.ref"] = "test-reference";
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(Principal(person, Scheme.Name), properties, Scheme.Name)));
        }
    }
}
