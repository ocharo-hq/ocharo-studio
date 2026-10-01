using System.Text.Json;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Represents one browser workspace's complete persisted editor state.</summary>
public sealed record StudioState(
    long Revision,
    JsonElement? Draft,
    JsonElement Looks,
    JsonElement Settings,
    JsonElement? Materials = null);

/// <summary>Describes the result of an optimistic state replacement.</summary>
public sealed record StudioStateWriteResult(
    StudioState? State,
    StudioStateWriteFailure? Failure = null);

public enum StudioStateWriteFailure
{
    RevisionConflict,
    MaterialsRequired
}
