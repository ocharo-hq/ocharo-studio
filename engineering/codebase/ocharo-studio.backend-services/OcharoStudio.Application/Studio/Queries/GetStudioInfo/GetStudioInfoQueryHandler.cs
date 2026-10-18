using OcharoStudio.Domain.Studio;
using WoW.Two.Sdk.Beta.Be.Mediator;

namespace OcharoStudio.Application.Studio.Queries.GetStudioInfo;

/// <summary>Describes the persisted studio contract served by this host.</summary>
internal sealed class GetStudioInfoQueryHandler : IRequestHandler<GetStudioInfoQuery, StudioInfo>
{
    public ValueTask<StudioInfo> HandleAsync(GetStudioInfoQuery request, CancellationToken ct)
    {
        var capabilities = Enum.GetNames<StudioCapability>()
            .Select(name => name.ToLowerInvariant())
            .ToArray();

        return ValueTask.FromResult(new StudioInfo(
            Product: "Ocharo Studio",
            DocumentSchemaVersion: 2,
            Storage: "sqlite",
            Capabilities: capabilities));
    }
}
