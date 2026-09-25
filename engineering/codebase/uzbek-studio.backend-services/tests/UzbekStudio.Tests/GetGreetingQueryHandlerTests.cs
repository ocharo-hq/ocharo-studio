using UzbekStudio.Application.Abstractions;
using UzbekStudio.Application.Greetings.Queries.GetGreeting;
using WoW.Two.Sdk.Backend.Beta.Foundation.Results;
using Xunit;

namespace UzbekStudio.Tests;

/// <summary>Covers the one vertical slice — the greeting query handler.</summary>
public sealed class GetGreetingQueryHandlerTests
{
    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }

    [Fact]
    public async Task Handle_WithName_ReturnsPersonalizedGreeting()
    {
        var handler = new GetGreetingQueryHandler(new FixedClock(DateTimeOffset.UnixEpoch));

        var result = await handler.HandleAsync(new GetGreetingQuery("UzbekStudio"), CancellationToken.None);

        var success = Assert.IsType<Result<string>.Success>(result);
        Assert.Contains("Hello, UzbekStudio!", success.Value);
    }
}
