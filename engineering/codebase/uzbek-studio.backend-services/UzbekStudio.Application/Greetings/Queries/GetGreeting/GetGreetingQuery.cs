using WoW.Two.Sdk.Backend.Beta.Mediator;
using WoW.Two.Sdk.Backend.Beta.Foundation.Results;

namespace UzbekStudio.Application.Greetings.Queries.GetGreeting;

/// <summary>Builds a greeting for the given name — the one vertical slice this uzbekstudio ships.</summary>
/// <param name="Name">The name to greet; blank falls back to a generic greeting.</param>
public sealed record GetGreetingQuery(string? Name = null) : IRequest<Result<string>>;
