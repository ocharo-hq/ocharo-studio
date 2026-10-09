using System.Net.Http.Json;
using System.Text.Json;

namespace Ocharo.Sso;

/// <summary>Talks only to a configured HTTPS Desk origin; browser cookies and redirects are never forwarded.</summary>
public sealed class SsoBackchannel(HttpClient http, SsoOptions options)
{
    internal Task<SsoGrant?> ExchangeAsync(string code, string verifier, CancellationToken ct)
    {
        return SendAsync<SsoGrant>("/api/sso/exchange", new { clientId = options.ClientId, clientSecret = options.ClientSecret,
            redirectUri = options.Callback, code, codeVerifier = verifier }, ct);
    }
    internal Task<SsoGrant?> RefreshAsync(string token, CancellationToken ct)
    {
        return SendAsync<SsoGrant>("/api/sso/refresh", new { clientId = options.ClientId, clientSecret = options.ClientSecret, refreshToken = token }, ct);
    }
    internal Task<SsoActor?> IntrospectAsync(string ticket, CancellationToken ct)
    {
        return SendAsync<SsoActor>("/api/integrations/introspect", new { token = ticket, audience = options.Audience }, ct);
    }
    internal async Task<bool> RevokeAsync(string token, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(options.DeskOrigin), "/api/sso/revoke"))
            { Content = JsonContent.Create(new { clientId = options.ClientId, clientSecret = options.ClientSecret, refreshToken = token }) };
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException) { return false; }
    }
    private async Task<T?> SendAsync<T>(string path, object payload, CancellationToken ct) where T : class
    {
        try
        {
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            budget.CancelAfter(TimeSpan.FromSeconds(5));
            using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(options.DeskOrigin), path))
            { Content = JsonContent.Create(payload) };
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, budget.Token);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 32_768) return null;
            await using var stream = await response.Content.ReadAsStreamAsync(budget.Token);
            using var buffer = new MemoryStream();
            var chunk = new byte[4096];
            int read;
            while ((read = await stream.ReadAsync(chunk, budget.Token)) > 0)
            {
                if (buffer.Length + read > 32_768) return null;
                buffer.Write(chunk, 0, read);
            }
            return JsonSerializer.Deserialize<SsoEnvelope<T>>(buffer.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web))?.Data;
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or OperationCanceledException or IOException) { return null; }
    }
}
