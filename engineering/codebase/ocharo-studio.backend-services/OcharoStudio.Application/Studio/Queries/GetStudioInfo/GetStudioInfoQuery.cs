using WoW.Two.Sdk.Beta.Be.Mediator;

namespace OcharoStudio.Application.Studio.Queries.GetStudioInfo;

/// <summary>Requests the stable product and document capabilities exposed by this host.</summary>
public sealed record GetStudioInfoQuery : IRequest<StudioInfo>;
