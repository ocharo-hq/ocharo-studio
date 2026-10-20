using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace OcharoStudio.Tests;

/// <summary>The conventional status endpoint reports the running version, anonymously, beside the retained version route.</summary>
public sealed class SystemStatusTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Status_ShouldReportTheInformationalVersionWithoutASession(bool sso)
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>(), sso);
        using var client = host.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(sso ? StudioHost.SsoOrigin : "https://localhost"), AllowAutoRedirect = false
        });

        using var status = await client.GetAsync("/api/system/status");
        using var version = await client.GetAsync("/api/system/version");

        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        Assert.True(status.Headers.CacheControl!.NoStore);
        var body = await status.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("OcharoStudio", body.GetProperty("service").GetString());
        Assert.Equal("live", body.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("version").GetString()));
        Assert.Equal(HttpStatusCode.OK, version.StatusCode);
        Assert.Equal(body.GetProperty("version").GetString(),
            (await version.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("version").GetString());
        if (sso)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/studio/state")).StatusCode);
    }
}
