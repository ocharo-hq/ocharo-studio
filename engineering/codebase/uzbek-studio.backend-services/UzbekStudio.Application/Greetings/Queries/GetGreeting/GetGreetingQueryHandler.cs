using UzbekStudio.Application.Abstractions;
using WoW.Two.Sdk.Backend.Beta.Foundation.Errors;
using WoW.Two.Sdk.Backend.Beta.Mediator;
using WoW.Two.Sdk.Backend.Beta.Foundation.Results;

namespace UzbekStudio.Application.Greetings.Queries.GetGreeting;

/// <summary>Handles <see cref="GetGreetingQuery"/> — composes the greeting and stamps it with the current time.</summary>
internal sealed class GetGreetingQueryHandler(IClock clock) : IRequestHandler<GetGreetingQuery, Result<string>>
{
    private const int MaxNameLength = 80;

    public ValueTask<Result<string>> HandleAsync(GetGreetingQuery request, CancellationToken ct)
    {
        var name = request.Name?.Trim();

        // Demonstrates the failure path: an over-long name maps to a 400 DomainError.
        if (name is { Length: > MaxNameLength })
        {
            var error = AppErrorFactory.Validation($"Name must be {MaxNameLength} characters or fewer.");
            return ValueTask.FromResult<Result<string>>(Result<string>.Fail(error));
        }

        var who = string.IsNullOrEmpty(name) ? "world" : name;
        var greeting = $"Hello, {who}! The time is {clock.UtcNow:O}.";

        return ValueTask.FromResult<Result<string>>(Result<string>.Ok(greeting));
    }
}
