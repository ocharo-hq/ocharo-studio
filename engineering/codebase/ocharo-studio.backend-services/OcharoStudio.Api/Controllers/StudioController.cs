using Microsoft.AspNetCore.Authorization;
using OcharoStudio.Api.Studio.Access;
using Microsoft.AspNetCore.Mvc;
using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Mediator;

namespace OcharoStudio.Api.Controllers;

/// <summary>Exposes the host's stable studio capability contract.</summary>
[ApiController]
[Route("api/studio")]
public sealed class StudioController(
    ISender sender,
    StudioStateService stateService,
    StudioStateValidator stateValidator,
    IStudioThumbnailStore thumbnails) : ControllerBase
{
    /// <summary>Returns product, document schema, storage boundary, and supported operations.</summary>
    [HttpGet]
    public async Task<ActionResult<StudioInfo>> Get(CancellationToken ct)
    {
        return Ok(await sender.SendAsync(new GetStudioInfoQuery(), ct));
    }

    /// <summary>Returns authenticated workspace routing, never a grant based on a browser UUID.</summary>
    [Authorize]
    [HttpGet("session")]
    public IActionResult Session()
    {
        Response.Headers.CacheControl = "no-store";
        if (StudioAccess.MemberOf(User) is not { } member) return Forbid();

        return Ok(new {
            workspaceId = member.WorkspaceId,
            userId = member.UserId,
            organizationId = member.OrganizationId,
            canEdit = member.CanEdit
        });
    }

    /// <summary>Returns state belonging to the member the session names.</summary>
    [Authorize]
    [HttpGet("state")]
    public async Task<ActionResult<StudioState>> GetState(
        [FromHeader(Name = "X-Studio-Workspace")] string? workspace,
        CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (SelectedMember(workspace) is not { } member) return Forbid();

        return Ok(await stateService.GetAsync(member.WorkspaceId, ct));
    }

    /// <summary>Atomically replaces a workspace state when its revision is current.</summary>
    [Authorize]
    [HttpPut("state")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<StudioState>> PutState(
        [FromHeader(Name = "X-Studio-Workspace")] string? workspace,
        [FromBody] StudioState request,
        CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (SelectedMember(workspace) is not { CanEdit: true } member) return Forbid();

        var errors = stateValidator.Validate(request);
        if (errors.Count > 0)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["state"] = [.. errors] }) { Status = StatusCodes.Status400BadRequest });

        StudioStateWriteResult result;
        try
        {
            result = await stateService.PutAsync(member.WorkspaceId, request, ct);
        }
        catch (StudioFilesException failure)
        {
            return Problem(statusCode: failure.Status, title: failure.Message);
        }
        if (result.Failure == StudioStateWriteFailure.ThumbnailUnknown)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]>
                {
                    ["thumbnail"] = ["A thumbnail link names a file this workspace does not hold."]
                }) { Status = StatusCodes.Status400BadRequest });
        if (result.Failure == StudioStateWriteFailure.MaterialsRequired)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]>
                {
                    ["materials"] =
                    ["Material metadata is required. Reload or upgrade the studio before saving."]
                }) { Status = StatusCodes.Status400BadRequest });
        if (result.State is null)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Revision conflict");

        return Ok(result.State);
    }

    /// <summary>Links to a saved look's thumbnail in WoW2 Files: a redirect to a short-lived link, for a member whose workspace
    /// state holds the thumbnail (the same rule as the state itself), cached privately for less than the link lives.</summary>
    [Authorize]
    [HttpGet("thumbnails/{sha256}/{fileId:guid}")]
    public async Task<IActionResult> GetThumbnail(string sha256, Guid fileId, CancellationToken ct)
    {
        if (SelectedMember(null) is not { } member) return Forbid();
        var route = StudioThumbnailRoute.Url(sha256, fileId);
        if (!thumbnails.Enabled || !StudioThumbnailRoute.TryParse(route, out _, out _)
            || !await stateService.HoldsThumbnailAsync(member.WorkspaceId, route, ct))
            return NotFound();

        try
        {
            if (await thumbnails.LinkAsync(fileId, ct) is not { } link) return NotFound();
            Response.Headers.CacheControl = "private, max-age=300";
            return Redirect(link.AbsoluteUri);
        }
        catch (StudioFilesException failure)
        {
            return Problem(statusCode: failure.Status, title: failure.Message);
        }
    }

    /// <summary>The session's member, unless the request names another workspace: the header selects only the authenticated one.</summary>
    private StudioMember? SelectedMember(string? supplied)
    {
        var member = StudioAccess.MemberOf(User);
        return member is not null && (supplied is null || Guid.TryParseExact(supplied, "D", out var selected) && selected == member.WorkspaceId)
            ? member : null;
    }
}
