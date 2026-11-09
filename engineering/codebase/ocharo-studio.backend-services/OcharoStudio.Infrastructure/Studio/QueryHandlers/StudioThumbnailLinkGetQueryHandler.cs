using OcharoStudio.Application.Studio.Errors;
using OcharoStudio.Application.Studio.Queries;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.Services;
using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Infrastructure.Studio.QueryHandlers;

/// <summary>Handles <see cref="StudioThumbnailLinkGetQuery"/>: links only a member whose workspace state holds the thumbnail
/// (the same rule as the state itself), and only while thumbnails are stored in WoW2 Files.</summary>
internal sealed class StudioThumbnailLinkGetQueryHandler(StudioStateService states, IStudioThumbnailStore thumbnails)
    : IQueryHandler<StudioThumbnailLinkGetQuery, AppResult<Uri>>
{
    /// <inheritdoc />
    public async ValueTask<AppResult<Uri>> HandleAsync(StudioThumbnailLinkGetQuery request, CancellationToken ct)
    {
        var route = StudioThumbnailRoute.Url(request.Sha256, request.FileId);
        if (!thumbnails.Enabled || !StudioThumbnailRoute.TryParse(route, out _, out _)
            || !await states.HoldsThumbnailAsync(request.WorkspaceId, route, ct))
            return AppResult<Uri>.Fail(StudioErrors.ThumbnailNotFound());

        try
        {
            return await thumbnails.LinkAsync(request.FileId, ct) is { } link
                ? AppResult<Uri>.Ok(link)
                : AppResult<Uri>.Fail(StudioErrors.ThumbnailNotFound());
        }
        catch (StudioFilesException failure)
        {
            return AppResult<Uri>.Fail(StudioErrors.FilesFailed(failure));
        }
    }
}
