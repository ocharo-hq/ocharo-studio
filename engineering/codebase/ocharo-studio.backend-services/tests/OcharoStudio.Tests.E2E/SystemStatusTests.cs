using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.E2E;

/// <summary>The conventional status endpoint reports the running version, anonymously; the retired version route is gone.</summary>
public sealed class SystemStatusTests
{
    [Fact]
    public async Task Status_ShouldReportTheInformationalVersionWithoutASession()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), realCookieScheme: true);
        using var client = StudioTestIdentity.Anonymous(host.Factory);

        using var status = await client.GetAsync("/api/system/status");
        using var version = await client.GetAsync("/api/system/version");

        status.StatusCode.Should().Be(HttpStatusCode.OK);
        status.Headers.CacheControl!.NoStore.Should().BeTrue();
        var body = await status.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("service").GetString().Should().Be("OcharoStudio");
        body.GetProperty("status").GetString().Should().Be("live");
        string.IsNullOrWhiteSpace(body.GetProperty("version").GetString()).Should().BeFalse();
        version.StatusCode.Should().Be(HttpStatusCode.NotFound);
        version.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        (await client.GetAsync("/api/studio/state")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
