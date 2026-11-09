using Microsoft.AspNetCore.Authorization;
using OcharoStudio.Api.Studio.Access;
using Microsoft.AspNetCore.Mvc;
using OcharoStudio.Application.Studio.Commands;
using OcharoStudio.Application.Studio.Queries;
using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Persistence.Import;
using WoW.Two.Sdk.Beta.Be.Mediator;
using WoW.Two.Sdk.Beta.Be.Web.ExceptionHandling.Extensions;

namespace OcharoStudio.Api.Studio.Controllers;

/// <summary>Exposes the host's stable studio capability contract.</summary>
[ApiController]
[Route("api/studio")]
public sealed class StudioController(
    ISender sender,
    LegacySqliteSettings legacy) : ControllerBase
{
    /// <summary>Answers state routes 503 while the retired SQLite store waits for <c>import-sqlite</c>, so no write lands in
    /// PostgreSQL before the copy and members keep their browser recovery copy meanwhile.</summary>
    private IActionResult? StorageMoving() =>
        System.IO.File.Exists(Path.GetFullPath(legacy.Path))
            ? Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Studio storage is moving",
                detail: "Your browser keeps a recovery copy until the move finishes.")
            : null;

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
    public async Task<IActionResult> GetState(
        [FromHeader(Name = "X-Studio-Workspace")] string? workspace,
        CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (SelectedMember(workspace) is not { } member) return Forbid();
        if (StorageMoving() is { } moving) return moving;

        var result = await sender.SendAsync(new StudioStateGetQuery { WorkspaceId = member.WorkspaceId }, ct);

        return result.Match<IActionResult>(
            ok => Ok(ok.Data),
            fail => this.ToProblem(fail.Error));
    }

    /// <summary>Atomically replaces a workspace state when its revision is current.</summary>
    [Authorize]
    [HttpPut("state")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> PutState(
        [FromHeader(Name = "X-Studio-Workspace")] string? workspace,
        [FromBody] StudioState request,
        CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (SelectedMember(workspace) is not { CanEdit: true } member) return Forbid();
        if (StorageMoving() is { } moving) return moving;

        var command = new StudioStateReplaceCommand
        {
            Workspace = new StudioWorkspace(member.WorkspaceId, member.OrganizationId, member.UserId),
            State = request,
        };
        var result = await sender.SendAsync(command, ct);

        return result.Match<IActionResult>(
            ok => Ok(ok.Data),
            fail => this.ToProblem(fail.Error));
    }

    /// <summary>Links to a saved look's thumbnail in WoW2 Files: a redirect to a short-lived link, for a member whose workspace
    /// state holds the thumbnail (the same rule as the state itself), cached privately for less than the link lives.</summary>
    [Authorize]
    [HttpGet("thumbnails/{sha256}/{fileId:guid}")]
    public async Task<IActionResult> GetThumbnail(string sha256, Guid fileId, CancellationToken ct)
    {
        if (SelectedMember(null) is not { } member) return Forbid();
        if (StorageMoving() is { } moving) return moving;

        var query = new StudioThumbnailLinkGetQuery { WorkspaceId = member.WorkspaceId, Sha256 = sha256, FileId = fileId };
        var result = await sender.SendAsync(query, ct);

        return result.Match<IActionResult>(
            ok =>
            {
                Response.Headers.CacheControl = "private, max-age=300";
                return Redirect(ok.Data.AbsoluteUri);
            },
            fail => this.ToProblem(fail.Error));
    }

    /// <summary>The session's member, unless the request names another workspace: the header selects only the authenticated one.</summary>
    private StudioMember? SelectedMember(string? supplied)
    {
        var member = StudioAccess.MemberOf(User);
        return member is not null && (supplied is null || Guid.TryParseExact(supplied, "D", out var selected) && selected == member.WorkspaceId)
            ? member : null;
    }
}
