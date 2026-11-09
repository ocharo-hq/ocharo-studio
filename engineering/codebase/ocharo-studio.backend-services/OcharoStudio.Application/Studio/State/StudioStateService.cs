using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Coordinates state reads and optimistic replacements for a browser workspace.</summary>
public sealed class StudioStateService(IStudioStateStore store, IStudioThumbnailStore thumbnails)
{
    private const string DataUrlPrefix = "data:image/webp;base64,";

    public Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct) =>
        store.GetAsync(workspaceId, ct);

    /// <summary>Replaces the state. With thumbnails in WoW2 Files, each new data-URL thumbnail is stored there and the state
    /// keeps its route URL; a thumbnail the stored state already holds stays as it is, a data URL included.</summary>
    /// <exception cref="StudioFilesException">Files refused a thumbnail.</exception>
    public async Task<StudioStateWriteResult> PutAsync(
        Guid workspaceId,
        StudioState state,
        CancellationToken ct)
    {
        if (!thumbnails.Enabled) return await store.PutAsync(workspaceId, state, ct);

        var previous = await store.GetAsync(workspaceId, ct);
        var held = ThumbnailsOf(previous.Looks).ToHashSet(StringComparer.Ordinal);
        if (JsonNode.Parse(state.Looks.GetRawText()) is not JsonArray looks) return await store.PutAsync(workspaceId, state, ct);

        var uploaded = new Dictionary<string, string>(StringComparer.Ordinal);
        var changed = false;
        foreach (var look in looks.OfType<JsonObject>())
        {
            if (look["thumbnail"] is not JsonValue node || !node.TryGetValue<string>(out var thumbnail)) continue;
            if (held.Contains(thumbnail)) continue;

            if (StudioThumbnailRoute.TryParse(thumbnail, out _, out _))
                return new StudioStateWriteResult(null, StudioStateWriteFailure.ThumbnailUnknown);
            if (!TryDecode(thumbnail, out var bytes, out var sha)) continue;

            // The same bytes under another look, or the stored route of a look saved before, keep one file.
            if (!uploaded.TryGetValue(sha, out var route))
            {
                route = held.FirstOrDefault(url => StudioThumbnailRoute.TryParse(url, out var heldSha, out _) && heldSha == sha)
                    ?? StudioThumbnailRoute.Url(sha, await thumbnails.StoreAsync(bytes, sha, ct));
                uploaded[sha] = route;
            }
            look["thumbnail"] = route;
            changed = true;
        }

        return await store.PutAsync(workspaceId,
            changed ? state with { Looks = JsonSerializer.SerializeToElement(looks) } : state, ct);
    }

    /// <summary>Tells whether the workspace's state holds this thumbnail route, so only its member is linked to the file.</summary>
    public async Task<bool> HoldsThumbnailAsync(Guid workspaceId, string route, CancellationToken ct) =>
        ThumbnailsOf((await store.GetAsync(workspaceId, ct)).Looks).Contains(route, StringComparer.Ordinal);

    private static IEnumerable<string> ThumbnailsOf(JsonElement looks) =>
        looks.ValueKind != JsonValueKind.Array
            ? []
            : looks.EnumerateArray()
                .Where(look => look.ValueKind == JsonValueKind.Object
                    && look.TryGetProperty("thumbnail", out var thumbnail) && thumbnail.ValueKind == JsonValueKind.String)
                .Select(look => look.GetProperty("thumbnail").GetString()!);

    /// <summary>Decodes a WebP data URL; anything else (another type, bad base64, not a WebP) stays as it is.</summary>
    private static bool TryDecode(string value, out byte[] bytes, out string sha256)
    {
        bytes = [];
        sha256 = "";
        if (!value.StartsWith(DataUrlPrefix, StringComparison.Ordinal)) return false;
        try { bytes = Convert.FromBase64String(value[DataUrlPrefix.Length..]); }
        catch (FormatException) { return false; }
        // RIFF....WEBP
        if (bytes.Length < 12 || !bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) || !bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8)) return false;
        sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));
        return true;
    }
}
