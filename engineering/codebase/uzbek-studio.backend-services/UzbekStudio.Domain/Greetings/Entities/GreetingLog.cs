using WoW.Two.Sdk.Backend.Beta.Data.Abstractions;

namespace UzbekStudio.Domain.Greetings.Entities;

/// <summary>A persisted record of a greeting that was served — the one entity this uzbekstudio maps to SQLite.</summary>
public sealed class GreetingLog : IKeyedEntity<Guid>
{
    /// <inheritdoc />
    public Guid Id { get; set; }

    /// <summary>Gets or sets the greeting text that was returned to the caller.</summary>
    public string Message { get; set; } = "";

    /// <summary>Gets or sets when the greeting was served (UTC).</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }
}
