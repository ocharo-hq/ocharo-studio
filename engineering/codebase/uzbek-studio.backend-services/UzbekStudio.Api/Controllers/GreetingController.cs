using WoW.Two.Sdk.Backend.Beta.Web.ErrorMapping;
using Microsoft.AspNetCore.Mvc;
using UzbekStudio.Application.Greetings.Queries.GetGreeting;
using WoW.Two.Sdk.Backend.Beta.Mediator;
using WoW.Two.Sdk.Backend.Beta.Foundation.Results;

namespace UzbekStudio.Api.Controllers;

/// <summary>The one demo endpoint — returns a greeting via the kit mediator + Result pattern.</summary>
[ApiController]
[Route("api/greeting")]
public sealed class GreetingController(ISender sender, IErrorHttpStatusCodeMapper errorMapper) : ControllerBase
{
    /// <summary>Returns a greeting, optionally personalized with <paramref name="name"/>.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? name, CancellationToken ct)
    {
        var result = await sender.SendAsync(new GetGreetingQuery(name), ct);
        return result switch
        {
            Result<string>.Success ok => Ok(new { message = ok.Value }),
            Result<string>.Failure fail => Problem(detail: fail.Error.Message, statusCode: errorMapper.ToStatusCode(fail.Error)),
            _ => Problem()
        };
    }
}
