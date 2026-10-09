using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;

namespace Ocharo.Sso;

/// <summary>Bounded single-process sessions. A restart invalidates app cookies; Desk can transparently authorize again.</summary>
public sealed class SsoSessionStore(TimeProvider clock)
{
    private const int MaximumEntries = 10_000;
    private readonly ConcurrentDictionary<string, SsoSession> sessions = new();
    private readonly ConcurrentDictionary<string, SsoChallenge> challenges = new();
    internal static string Secret() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    internal SsoChallenge? Start(string returnUrl)
    {
        Prune();
        if (challenges.Count >= MaximumEntries) return null;
        var value = new SsoChallenge(Secret(), Secret(), Secret(), returnUrl, clock.GetUtcNow().AddMinutes(5));
        return challenges.TryAdd(value.State, value) ? value : null;
    }
    internal SsoChallenge? Consume(string state, string correlation)
    {
        if (!challenges.TryGetValue(state, out var found) || !Equal(found.Correlation, correlation) || found.Expires <= clock.GetUtcNow()) return null;
        return challenges.TryRemove(state, out var removed) ? removed : null;
    }
    internal string? Add(SsoGrant grant)
    {
        Prune();
        if (sessions.Count >= MaximumEntries) return null;
        var id = Secret();
        return sessions.TryAdd(id, new SsoSession(grant)) ? id : null;
    }
    internal SsoSession? Find(string? id)
    {
        return id is { Length:43 } && sessions.TryGetValue(id, out var value) && value.Grant.SessionExpiresAt > clock.GetUtcNow() ? value : null;
    }
    internal void Remove(string? id)
    {
        if (id is not null && sessions.TryRemove(id, out var value)) value.Removed = true;
    }
    internal static bool Equal(string left, string right)
    {
        return CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(left), System.Text.Encoding.UTF8.GetBytes(right));
    }
    private void Prune()
    {
        var now = clock.GetUtcNow();
        foreach (var pair in challenges) if (pair.Value.Expires <= now) challenges.TryRemove(pair.Key, out _);
        foreach (var pair in sessions) if (pair.Value.Grant.SessionExpiresAt <= now) Remove(pair.Key);
    }
}
internal sealed record SsoChallenge(string State, string Correlation, string Verifier, string ReturnUrl, DateTimeOffset Expires);
internal sealed class SsoSession(SsoGrant grant)
{
    public SsoGrant Grant { get; set; } = grant;
    public string Csrf { get; } = SsoSessionStore.Secret();
    public SemaphoreSlim Gate { get; } = new(1,1);
    public volatile bool Removed;
}
