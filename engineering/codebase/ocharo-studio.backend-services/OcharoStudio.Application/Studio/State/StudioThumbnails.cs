using System.Text.RegularExpressions;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Keeps a saved look's thumbnail outside the state JSON: a new one is stored once per SHA-256 and the state keeps
/// the Studio route that links to it (planning/files-adoption.md #12).</summary>
public interface IStudioThumbnailStore
{
    /// <summary>Tells whether thumbnails go to WoW2 Files; when not, the state keeps data URLs as ever.</summary>
    bool Enabled { get; }

    /// <summary>Stores the WebP bytes once per <paramref name="sha256"/> and returns the file id.</summary>
    /// <exception cref="StudioFilesException">Files refused the upload.</exception>
    Task<Guid> StoreAsync(byte[] webp, string sha256, CancellationToken ct);

    /// <summary>Issues a short-lived link to the file, or null when the file is gone.</summary>
    /// <exception cref="StudioFilesException">Files refused the call.</exception>
    Task<Uri?> LinkAsync(Guid fileId, CancellationToken ct);
}

/// <summary>A Files call that failed, with the HTTP status Studio answers: 400, 404, 503, else 502.</summary>
public sealed class StudioFilesException(string message, int status) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>The thumbnails of a run without <c>Files:BaseUrl</c>: none, so data URLs stay in the state.</summary>
public sealed class DisabledStudioThumbnailStore : IStudioThumbnailStore
{
    public bool Enabled => false;

    public Task<Guid> StoreAsync(byte[] webp, string sha256, CancellationToken ct) => throw new InvalidOperationException("Thumbnails are not stored in WoW2 Files.");

    public Task<Uri?> LinkAsync(Guid fileId, CancellationToken ct) => throw new InvalidOperationException("Thumbnails are not stored in WoW2 Files.");
}

/// <summary>The route URL a stored thumbnail has in the state: the SHA-256 of its bytes and its file id.</summary>
public static partial class StudioThumbnailRoute
{
    public const string Prefix = "/api/studio/thumbnails/";

    /// <summary>The record type of the reference that keeps a thumbnail alive; its record id is the SHA-256.</summary>
    public const string ReferenceType = "studio.thumbnail";

    /// <summary>The app every Studio file belongs to: Studio's Identity client id, so Files applies one policy.</summary>
    public const string AppId = "studio";

    public static string Url(string sha256, Guid fileId) => $"{Prefix}{sha256}/{fileId:D}";

    public static bool TryParse(string? value, out string sha256, out Guid fileId)
    {
        sha256 = "";
        fileId = default;
        var match = value is null ? null : Shape().Match(value);
        if (match is not { Success: true } || !Guid.TryParseExact(match.Groups["id"].Value, "D", out fileId)) return false;
        sha256 = match.Groups["sha"].Value;
        return true;
    }

    [GeneratedRegex("^/api/studio/thumbnails/(?<sha>[0-9a-f]{64})/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$", RegexOptions.CultureInvariant)]
    private static partial Regex Shape();
}
