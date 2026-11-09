using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Application.Studio.Queries;

/// <summary>Represents a query to get a short-lived WoW2 Files link to a saved look's thumbnail the workspace holds.</summary>
public sealed record StudioThumbnailLinkGetQuery : IQuery<AppResult<Uri>>
{
    /// <summary>Gets the workspace whose state must hold the thumbnail.</summary>
    public required Guid WorkspaceId { get; init; }

    /// <summary>Gets the SHA-256 of the thumbnail's bytes, as its route names it.</summary>
    public required string Sha256 { get; init; }

    /// <summary>Gets the WoW2 Files id of the thumbnail.</summary>
    public required Guid FileId { get; init; }
}
