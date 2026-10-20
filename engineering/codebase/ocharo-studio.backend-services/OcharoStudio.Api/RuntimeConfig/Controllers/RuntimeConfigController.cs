using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OcharoStudio.Api.RuntimeConfig.Settings;

namespace OcharoStudio.Api.RuntimeConfig.Controllers;

/// <summary>Exposes public runtime settings over HTTP.</summary>
[ApiController]
[Route("api/runtime-config")]
public sealed class RuntimeConfigController(OcharoAppsSettings apps) : ControllerBase
{
    /// <summary>Gets the public runtime settings.</summary>
    [HttpGet]
    [AllowAnonymous]
    public ActionResult<IReadOnlyDictionary<string, string>> Get()
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(apps.ToRuntimeConfig());
    }
}
