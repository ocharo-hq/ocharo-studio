using Microsoft.AspNetCore.Http;
using OcharoStudio.Application.Studio.Errors;
using WoW.Two.Sdk.Beta.Be.Foundation.Errors;
using WoW.Two.Sdk.Beta.Be.Web.ErrorMapping;

namespace OcharoStudio.Api.Studio.Errors;

/// <summary>Maps an application error to its HTTP status: a call WoW2 Files refused (<see cref="StudioErrors.FilesRefusedKey"/>)
/// to 502 Bad Gateway, every other error by the be sdk's defaults.</summary>
public sealed class StudioErrorHttpStatusCodeMapper : IErrorHttpStatusCodeMapper
{
    private readonly ErrorHttpStatusCodeMapper defaults = new();

    /// <summary>Maps <paramref name="error"/> to the HTTP status the host answers it with.</summary>
    /// <param name="error">The error to map.</param>
    /// <returns>The HTTP status code.</returns>
    public int ToStatusCode(AppError error)
    {
        ArgumentNullException.ThrowIfNull(error);

        return error.Metadata?.ContainsKey(StudioErrors.FilesRefusedKey) == true
            ? StatusCodes.Status502BadGateway
            : defaults.ToStatusCode(error);
    }
}
