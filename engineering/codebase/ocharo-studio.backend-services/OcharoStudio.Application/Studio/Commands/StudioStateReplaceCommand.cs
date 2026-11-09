using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Application.Studio.Commands;

/// <summary>Represents a command to replace a workspace's studio state when its revision is current.</summary>
public sealed record StudioStateReplaceCommand : ICommand<AppResult<StudioState>>
{
    /// <summary>Gets the workspace, with the organization and account that own it.</summary>
    public required StudioWorkspace Workspace { get; init; }

    /// <summary>Gets the state to store, carrying the revision it was read at.</summary>
    public required StudioState State { get; init; }
}
