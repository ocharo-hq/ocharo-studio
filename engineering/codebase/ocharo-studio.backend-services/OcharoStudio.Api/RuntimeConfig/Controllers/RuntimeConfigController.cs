using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OcharoStudio.Api.RuntimeConfig.Settings;

namespace OcharoStudio.Api.RuntimeConfig.Controllers;

/// <summary>Exposes public runtime settings over HTTP.</summary>
[ApiController]
[Route("api/runtime-config")]
public sealed class RuntimeConfigController(OcharoAppsSettings apps) : ControllerBase
{
    /// <summary>Writes the keys as the SPA's config seam names them (<c>OCHARO_DESK_URL</c>): the SDK JSON contract would
    /// camel-case a dictionary's keys.</summary>
    private static readonly JsonSerializerOptions KeysAsNamed = new(JsonSerializerDefaults.Web) { DictionaryKeyPolicy = null };

    /// <summary>Gets the public runtime settings.</summary>
    [HttpGet]
    [AllowAnonymous]
    public JsonResult Get()
    {
        Response.Headers.CacheControl = "no-store";
        return new JsonResult(apps.ToRuntimeConfig(), KeysAsNamed);
    }
}
