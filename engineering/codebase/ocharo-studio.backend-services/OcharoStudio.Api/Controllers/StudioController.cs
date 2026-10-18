using System.Security.Claims;
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
    StudioStateValidator stateValidator) : ControllerBase
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
        return Ok(new {
            workspaceId = User.FindFirstValue(StudioIntegrationAuthenticationHandler.WorkspaceClaim),
            userId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            organizationId = User.FindFirstValue(StudioIntegrationAuthenticationHandler.OrganizationClaim),
            canEdit = User.FindFirstValue(StudioIntegrationAuthenticationHandler.EditClaim) == "true",
            expiresAt = User.FindFirstValue("ocharo:expires-at")
        });
    }

    /// <summary>Returns state belonging to the member identified by the Desk ticket.</summary>
    [Authorize]
    [HttpGet("state")]
    public async Task<ActionResult<StudioState>> GetState(
        [FromHeader(Name = "X-Studio-Workspace")] string? workspace,
        CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (!TryWorkspace(workspace, out var workspaceId)) return Forbid();

        return Ok(await stateService.GetAsync(workspaceId, ct));
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
        if (!TryWorkspace(workspace, out var workspaceId)) return Forbid();

        if (User.FindFirstValue(StudioIntegrationAuthenticationHandler.EditClaim) != "true") return Forbid();

        var errors = stateValidator.Validate(request);
        if (errors.Count > 0)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["state"] = [.. errors] }) { Status = StatusCodes.Status400BadRequest });

        var result = await stateService.PutAsync(workspaceId, request, ct);
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

    private bool TryWorkspace(string? supplied, out Guid workspaceId)
    {
        var owned = User.FindFirstValue(StudioIntegrationAuthenticationHandler.WorkspaceClaim);
        return Guid.TryParseExact(owned, "D", out workspaceId) && workspaceId != Guid.Empty &&
            (supplied is null || Guid.TryParseExact(supplied, "D", out var selected) && selected == workspaceId);
    }
}
