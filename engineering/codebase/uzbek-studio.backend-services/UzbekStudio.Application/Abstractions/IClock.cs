namespace UzbekStudio.Application.Abstractions;

/// <summary>Provides the current time — abstracted for testability.</summary>
public interface IClock
{
    /// <summary>Gets the current UTC time.</summary>
    DateTimeOffset UtcNow { get; }
}
