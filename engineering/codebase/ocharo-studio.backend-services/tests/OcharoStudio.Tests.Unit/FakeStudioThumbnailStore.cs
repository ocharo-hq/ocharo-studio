using OcharoStudio.Application.Studio.State;

namespace OcharoStudio.Tests.Unit;

/// <summary>A thumbnail store standing in for WoW2 Files: it raises <see cref="Refusal"/> when set, else stores under a new id
/// and links to <see cref="Link"/>.</summary>
internal sealed class FakeStudioThumbnailStore(bool enabled = true) : IStudioThumbnailStore
{
    public bool Enabled => enabled;

    public StudioFilesException? Refusal { get; set; }

    public Uri? Link { get; set; } = new("https://files.example/link");

    public Task<Guid> StoreAsync(byte[] webp, string sha256, CancellationToken ct) =>
        Refusal is { } refusal ? throw refusal : Task.FromResult(Guid.NewGuid());

    public Task<Uri?> LinkAsync(Guid fileId, CancellationToken ct) =>
        Refusal is { } refusal ? throw refusal : Task.FromResult(Link);
}
