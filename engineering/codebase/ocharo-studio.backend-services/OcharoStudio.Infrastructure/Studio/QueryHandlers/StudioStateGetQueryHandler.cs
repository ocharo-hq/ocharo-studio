using OcharoStudio.Application.Studio.Queries;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.Services;
using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Infrastructure.Studio.QueryHandlers;

/// <summary>Handles <see cref="StudioStateGetQuery"/>.</summary>
internal sealed class StudioStateGetQueryHandler(StudioStateService states)
    : IQueryHandler<StudioStateGetQuery, AppResult<StudioState>>
{
    /// <inheritdoc />
    public async ValueTask<AppResult<StudioState>> HandleAsync(StudioStateGetQuery request, CancellationToken ct)
    {
        var state = await states.GetAsync(request.WorkspaceId, ct);

        return AppResult<StudioState>.Ok(state);
    }
}
