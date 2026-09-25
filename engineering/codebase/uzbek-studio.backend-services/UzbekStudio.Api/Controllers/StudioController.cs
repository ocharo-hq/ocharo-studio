using Microsoft.AspNetCore.Mvc;
using UzbekStudio.Application.Studio.Queries.GetStudioInfo;
using WoW.Two.Sdk.Backend.Beta.Mediator;

namespace UzbekStudio.Api.Controllers;

/// <summary>Exposes the host's stable studio capability contract.</summary>
[ApiController]
[Route("api/studio")]
public sealed class StudioController(ISender sender) : ControllerBase
{
    /// <summary>Returns product, document schema, storage boundary, and supported operations.</summary>
    [HttpGet]
    public async Task<ActionResult<StudioInfo>> Get(CancellationToken ct)
    {
        return Ok(await sender.SendAsync(new GetStudioInfoQuery(), ct));
    }
}
