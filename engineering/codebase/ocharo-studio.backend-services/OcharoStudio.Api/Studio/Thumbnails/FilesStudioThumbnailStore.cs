using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Files;
using WoW.Two.Sdk.Beta.Be.Files.References;
using WoW.Two.Sdk.Beta.Be.Files.Store;
using WoW.Two.Sdk.Beta.Be.Files.Uploads;
using WoW.Two.Sdk.Beta.Be.Files.Urls;
using WoW.Two.Sdk.Beta.Be.Foundation.Errors;
using WoW.Two.Sdk.Beta.Be.Foundation.Results;

namespace OcharoStudio.Api.Studio.Thumbnails;

/// <summary>Stores saved-look thumbnails in WoW2 Files once per SHA-256 (the upload's idempotency key), keeps each alive by a
/// <see cref="StudioThumbnailRoute.ReferenceType"/> reference, and links to it for <see cref="LinkLifetime"/>.</summary>
/// <remarks>Files is called with the signed-in person's exchanged token: a thumbnail is stored and read only within a session.</remarks>
public sealed class FilesStudioThumbnailStore(IFileUploadsBroker uploads, IFileReferencesBroker references, IFileUrlsBroker urls) : IStudioThumbnailStore
{
    /// <summary>How long a link to a thumbnail lives; the route answers a redirect cached for less (<c>max-age=300</c>).</summary>
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(15);

    public bool Enabled => true;

    public async Task<Guid> StoreAsync(byte[] webp, string sha256, CancellationToken ct)
    {
        await using var content = new MemoryStream(webp, false);
        var spec = new UploadSpec
        {
            Name = $"{sha256[..16]}.webp",
            ContentType = "image/webp",
            AppId = StudioThumbnailRoute.AppId,
            IdempotencyKey = $"{StudioThumbnailRoute.ReferenceType}:{sha256}",
        };
        var file = Unwrap(await uploads.UploadAsync(content, spec, ct));
        Unwrap(await references.AttachAsync(file.Id, new FileReference(StudioThumbnailRoute.ReferenceType, sha256), ct));
        return file.Id.Value;
    }

    public async Task<Uri?> LinkAsync(Guid fileId, CancellationToken ct)
    {
        var result = await urls.IssueAsync(new FileId(fileId), new UrlSpec { Lifetime = LinkLifetime }, ct);
        if (result is Result<SignedFileUrl>.Failure { Error.Type: AppErrorType.NotFound }) return null;
        return Unwrap(result).Url;
    }

    private static T Unwrap<T>(Result<T> result) where T : notnull => result.Match(value => value, error => throw Refusal(error));

    private static void Unwrap(Result result) => result.Match(() => true, error => throw Refusal(error));

    private static StudioFilesException Refusal(AppError error) => error.Type switch
    {
        AppErrorType.Validation => new StudioFilesException(error.Message, 400),
        AppErrorType.NotFound => new StudioFilesException("The file is gone from WoW2 Files.", 404),
        AppErrorType.ExternalUnavailable => new StudioFilesException("WoW2 Files is unavailable; try again shortly.", 503),
        _ => new StudioFilesException($"WoW2 Files refused the call: {error.Message}", 502),
    };
}
