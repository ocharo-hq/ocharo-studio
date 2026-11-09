using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using AwesomeAssertions;
using Xunit;
using static OcharoStudio.Tests.E2E.StudioTestIdentity;

namespace OcharoStudio.Tests.E2E;

/// <summary>A refused save answers its status as a problem through the be sdk's problem factory: a stale revision 409, an
/// invalid state 400 with its failures under <c>state</c>, both uncached.</summary>
public sealed class StateProblemTests
{
    private const string State = "/api/studio/state";

    [Fact]
    public async Task Save_ShouldAnswerAConflictProblem_WhenTheRevisionIsStale()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);
        using (var first = await editor.PutAsJsonAsync(State, StateAt(0))) first.StatusCode.Should().Be(HttpStatusCode.OK);

        using var stale = await editor.PutAsJsonAsync(State, StateAt(0));

        stale.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (stale.Content.Headers.ContentType?.MediaType).Should().Be("application/problem+json");
        (stale.Headers.CacheControl?.NoStore).Should().BeTrue();
        var problem = await stale.Content.ReadFromJsonAsync<JsonElement>();
        problem.GetProperty("status").GetInt32().Should().Be(409);
        problem.GetProperty("detail").GetString().Should().Be("Revision conflict");
    }

    [Fact]
    public async Task Save_ShouldAnswerAValidationProblemUnderState_WhenTheStateIsInvalid()
    {
        await using var host = StudioHost.Create(new Dictionary<string, string?>());
        using var editor = await SignedIn(host.Factory, Editor);

        using var invalid = await editor.PutAsJsonAsync(State, StateAt(0) with { settings = (object)"not an object" });

        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (invalid.Content.Headers.ContentType?.MediaType).Should().Be("application/problem+json");
        (invalid.Headers.CacheControl?.NoStore).Should().BeTrue();
        var problem = await invalid.Content.ReadFromJsonAsync<JsonElement>();
        problem.GetProperty("errors").EnumerateArray().Should().ContainSingle().Which.Should().Match<JsonElement>(failure =>
            failure.GetProperty("property").GetString() == "state"
            && failure.GetProperty("message").GetString() == "settings must be an object.");
    }

    private static Body StateAt(long revision) => new(revision, null, [], new { }, new { });

    private sealed record Body(long revision, object? draft, object[] looks, object settings, object materials);
}
