using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Application.Studio.Queries;

/// <summary>Represents a query to get a workspace's studio state.</summary>
public sealed record StudioStateGetQuery : IQuery<AppResult<StudioState>>
{
    /// <summary>Gets the workspace whose state is read.</summary>
    public required Guid WorkspaceId { get; init; }
}
