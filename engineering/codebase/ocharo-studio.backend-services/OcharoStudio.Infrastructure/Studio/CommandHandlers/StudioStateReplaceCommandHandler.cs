using OcharoStudio.Application.Studio.Commands;
using OcharoStudio.Application.Studio.Errors;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.Services;
using OcharoStudio.Infrastructure.Studio.Validators;
using WoW.Two.Sdk.Beta.Be.Mediator.Cqrs;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;

namespace OcharoStudio.Infrastructure.Studio.CommandHandlers;

/// <summary>Handles <see cref="StudioStateReplaceCommand"/>: validates the state, then replaces it when its revision is current.</summary>
internal sealed class StudioStateReplaceCommandHandler(StudioStateService states, StudioStateValidator validator)
    : ICommandHandler<StudioStateReplaceCommand, AppResult<StudioState>>
{
    /// <inheritdoc />
    public async ValueTask<AppResult<StudioState>> HandleAsync(StudioStateReplaceCommand request, CancellationToken ct)
    {
        var errors = validator.Validate(request.State);
        if (errors.Count > 0)
            return AppResult<StudioState>.Fail(StudioErrors.StateInvalid(errors));

        StudioStateWriteResult result;
        try
        {
            result = await states.PutAsync(request.Workspace, request.State, ct);
        }
        catch (StudioFilesException failure)
        {
            return AppResult<StudioState>.Fail(StudioErrors.FilesFailed(failure));
        }

        return result switch
        {
            { Failure: StudioStateWriteFailure.ThumbnailUnknown } => AppResult<StudioState>.Fail(StudioErrors.ThumbnailUnknown()),
            { Failure: StudioStateWriteFailure.MaterialsRequired } => AppResult<StudioState>.Fail(StudioErrors.MaterialsRequired()),
            { State: { } saved } => AppResult<StudioState>.Ok(saved),
            _ => AppResult<StudioState>.Fail(StudioErrors.RevisionConflict()),
        };
    }
}
