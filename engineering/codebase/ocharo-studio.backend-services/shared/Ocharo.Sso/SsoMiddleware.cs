using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;

namespace Ocharo.Sso;

/// <summary>App-local browser sessions backed by live Desk authorization; grants never enter browser storage.</summary>
public sealed class SsoMiddleware(RequestDelegate next, SsoRouting routing)
{
    public async Task InvokeAsync(HttpContext http, SsoOptions options, SsoSessionStore store, SsoBackchannel channel, TimeProvider clock)
    {
        var path = http.Request.Path;
        if (!options.Enabled)
        {
            if (path == "/api/sso/session") await JsonAsync(http, new { enabled = false, authenticated = false });
            else if (path.StartsWithSegments("/api/sso")) await ProblemAsync(http, 404, "SSO is not configured", "sso_disabled");
            else await next(http);
            return;
        }
        if (!options.MatchesHost(http.Request))
        {
            await ProblemAsync(http, 400, "Use this application's configured secure address", "sso_origin_invalid");
            return;
        }
        if (path == "/api/sso/login" && HttpMethods.IsGet(http.Request.Method))
        {
            await StartAsync(http, options, store);
            return;
        }
        if (path == "/api/sso/callback" && HttpMethods.IsGet(http.Request.Method))
        {
            await CallbackAsync(http, options, store, channel, clock);
            return;
        }
        var ownEndpoint = path == "/api/sso/session" || path == "/api/sso/logout";
        var privateApi = path.StartsWithSegments("/api") && !routing.IsPublic(http);
        var navigation = !path.StartsWithSegments("/api") && !routing.IsPublic(http) && HttpMethods.IsGet(http.Request.Method) &&
            !Path.HasExtension(path.Value) && http.Request.Headers.Accept.ToString().Contains("text/html", StringComparison.OrdinalIgnoreCase);
        var resolveResource = routing.ResolveSession(http);
        if (!ownEndpoint && !privateApi && !navigation && !resolveResource) { await next(http); return; }
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers["X-Content-Type-Options"] = "nosniff";
        var sessionId = http.Request.Cookies[options.CookieName];
        var session = store.Find(sessionId);
        SsoActor? actor = null;
        var bearer = http.Request.Headers.Authorization.ToString();
        var fromCookie = !bearer.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);
        if (!fromCookie)
        {
            var ticket = bearer[7..].Trim();
            if (ticket.Length is > 0 and <= 8192) actor = await channel.IntrospectAsync(ticket, http.RequestAborted);
            session = null;
        }
        else if (session is not null)
        {
            await session.Gate.WaitAsync(http.RequestAborted);
            try
            {
                if (!session.Removed)
                {
                    if (session.Grant.ExpiresAt <= clock.GetUtcNow().AddSeconds(30))
                    {
                        var renewed = await channel.RefreshAsync(session.Grant.RefreshToken, http.RequestAborted);
                        if (ValidGrant(renewed, clock.GetUtcNow())) session.Grant = renewed!;
                        else store.Remove(sessionId);
                    }
                    if (!session.Removed) actor = await channel.IntrospectAsync(session.Grant.Ticket, http.RequestAborted);
                }
                if (actor is null || !actor.Valid(options, clock.GetUtcNow())) store.Remove(sessionId);
            }
            finally { session.Gate.Release(); }
        }
        if (actor is not null && !actor.Valid(options, clock.GetUtcNow())) actor = null;
        if (actor is null)
        {
            if (sessionId is not null) http.Response.Cookies.Delete(options.CookieName, Cookie());
            if (path == "/api/sso/session" && HttpMethods.IsGet(http.Request.Method))
                await JsonAsync(http, new { enabled = true, authenticated = false, accountUrl = options.DeskOrigin });
            else if (resolveResource && !privateApi && !navigation && !ownEndpoint) await next(http);
            else if (navigation) await StartAsync(http, options, store, http.Request.Path + http.Request.QueryString);
            else await ProblemAsync(http, 401, "Sign in through Ocharo Desk", "sso_sign_in_required");
            return;
        }
        http.User = actor.Principal();
        http.Items[SsoContext.ActorKey] = actor;
        http.Items[SsoContext.TicketKey] = fromCookie ? session!.Grant.Ticket : bearer[7..].Trim();
        if (!Safe(http.Request.Method) && fromCookie && (session is null || !ValidCsrf(http, session, options)))
        {
            await ProblemAsync(http, 403, "Refresh the page before trying again", "sso_csrf_invalid");
            return;
        }
        if (path == "/api/sso/session" && HttpMethods.IsGet(http.Request.Method))
        {
            await JsonAsync(http, new { enabled = true, authenticated = true, accountUrl = options.DeskOrigin, userId = actor.UserId,
                organizationId = actor.OrganizationId, canEdit = actor.CanEdit, canApprove = actor.CanApprove,
                csrfToken = fromCookie ? session?.Csrf : null });
            return;
        }
        if (path == "/api/sso/logout" && HttpMethods.IsPost(http.Request.Method))
        {
            if (session is null) { await ProblemAsync(http, 400, "A browser session is required", "sso_session_required"); return; }
            await session.Gate.WaitAsync(http.RequestAborted);
            try
            {
                if (!await channel.RevokeAsync(session.Grant.RefreshToken, http.RequestAborted))
                { await ProblemAsync(http, 503, "Could not end the Desk connection", "sso_unavailable"); return; }
                store.Remove(sessionId);
                http.Response.Cookies.Delete(options.CookieName, Cookie());
                http.Response.StatusCode = 204;
            }
            finally { session.Gate.Release(); }
            return;
        }
        if (path.StartsWithSegments("/api/sso")) { await ProblemAsync(http, 404, "Route not found", "not_found"); return; }
        if (!Safe(http.Request.Method) && !actor.CanEdit)
        { await ProblemAsync(http, 403, "Editing access is required", "sso_edit_required"); return; }
        await next(http);
    }

    private static async Task StartAsync(HttpContext http, SsoOptions options, SsoSessionStore store, string? destination = null)
    {
        var returnUrl = destination ?? http.Request.Query["returnUrl"].ToString();
        if (string.IsNullOrEmpty(returnUrl)) returnUrl = "/";
        if (!LocalReturn(returnUrl)) { await ProblemAsync(http, 400, "Invalid return destination", "sso_return_invalid"); return; }
        var challenge = store.Start(returnUrl);
        if (challenge is null) { await ProblemAsync(http, 429, "Try again shortly", "sso_busy"); return; }
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers["Referrer-Policy"] = "no-referrer";
        http.Response.Cookies.Append(options.CorrelationCookie, challenge.Correlation, Cookie(TimeSpan.FromMinutes(5)));
        http.Response.Redirect(QueryHelpers.AddQueryString(options.DeskOrigin.TrimEnd('/') + "/api/sso/authorize", new Dictionary<string,string?>
        {
            ["clientId"] = options.ClientId, ["redirectUri"] = options.Callback, ["state"] = challenge.State,
            ["codeChallenge"] = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(challenge.Verifier)))
        }));
    }
    private static async Task CallbackAsync(HttpContext http, SsoOptions options, SsoSessionStore store, SsoBackchannel channel, TimeProvider clock)
    {
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers["Referrer-Policy"] = "no-referrer";
        var state = http.Request.Query["state"].ToString();
        var code = http.Request.Query["code"].ToString();
        var correlation = http.Request.Cookies[options.CorrelationCookie];
        var pending = state.Length == 43 && code.Length == 43 && correlation is { Length:43 } ? store.Consume(state, correlation) : null;
        http.Response.Cookies.Delete(options.CorrelationCookie, Cookie());
        if (pending is null) { await ProblemAsync(http, 400, "Restart sign-in from this application", "sso_callback_invalid"); return; }
        var grant = await channel.ExchangeAsync(code, pending.Verifier, http.RequestAborted);
        var actor = ValidGrant(grant, clock.GetUtcNow()) ? await channel.IntrospectAsync(grant!.Ticket, http.RequestAborted) : null;
        if (actor is null || !actor.Valid(options, clock.GetUtcNow()))
        { await ProblemAsync(http, 401, "This Desk account cannot access the application", "sso_access_denied"); return; }
        var id = store.Add(grant!);
        if (id is null) { await ProblemAsync(http, 503, "Try again shortly", "sso_busy"); return; }
        store.Remove(http.Request.Cookies[options.CookieName]);
        http.Response.Cookies.Append(options.CookieName, id, Cookie());
        http.Response.Redirect(pending.ReturnUrl);
    }
    private static bool ValidGrant(SsoGrant? grant, DateTimeOffset now)
    {
        return grant is { Ticket.Length: >0 and <=8192, RefreshToken.Length:43 } && grant.ExpiresAt > now &&
            grant.ExpiresAt <= now.AddMinutes(5).AddSeconds(5) && grant.SessionExpiresAt > now && grant.SessionExpiresAt <= now.AddHours(8).AddSeconds(5);
    }
    private static bool ValidCsrf(HttpContext http, SsoSession session, SsoOptions options)
    {
        var origin = http.Request.Headers.Origin.ToString();
        return (origin.Length == 0 || string.Equals(origin, options.ClientOrigin.TrimEnd('/'), StringComparison.OrdinalIgnoreCase)) &&
            http.Request.Headers["Sec-Fetch-Site"].ToString() != "cross-site" &&
            SsoSessionStore.Equal(session.Csrf, http.Request.Headers["X-CSRF-Token"].ToString());
    }
    private static bool Safe(string method) => HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
    private static bool LocalReturn(string value)
    {
        return value.Length is >0 and <=2048 && value[0] == '/' && !value.StartsWith("//", StringComparison.Ordinal) &&
            !value.Contains('\\') && !value.Any(char.IsControl) && !value.Contains('%') && !value.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);
    }
    private static CookieOptions Cookie(TimeSpan? age = null) => new()
    { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax, Path = "/", IsEssential = true, MaxAge = age };
    private static Task ProblemAsync(HttpContext http, int status, string title, string code) => Results.Problem(statusCode:status, title:title,
        extensions:new Dictionary<string,object?> { ["code"] = code }).ExecuteAsync(http);
    private static Task JsonAsync(HttpContext http, object data) => http.Response.WriteAsJsonAsync(new { data }, http.RequestAborted);
}
