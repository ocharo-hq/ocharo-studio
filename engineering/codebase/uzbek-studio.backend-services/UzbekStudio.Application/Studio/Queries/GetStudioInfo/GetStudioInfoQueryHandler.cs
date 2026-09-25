using UzbekStudio.Domain.Studio;
using WoW.Two.Sdk.Backend.Beta.Mediator;

namespace UzbekStudio.Application.Studio.Queries.GetStudioInfo;

/// <summary>Describes the browser-local studio contract served by this host.</summary>
internal sealed class GetStudioInfoQueryHandler : IRequestHandler<GetStudioInfoQuery, StudioInfo>
{
    public ValueTask<StudioInfo> HandleAsync(GetStudioInfoQuery request, CancellationToken ct)
    {
        var capabilities = Enum.GetNames<StudioCapability>()
            .Select(name => name.ToLowerInvariant())
            .ToArray();

        return ValueTask.FromResult(new StudioInfo(
            Product: "Uzbek Studio",
            DocumentSchemaVersion: 1,
            Storage: "browser-local",
            Capabilities: capabilities));
    }
}
