namespace OcharoStudio.Application.Studio.State;

/// <summary>Coordinates state reads and optimistic replacements for a browser workspace.</summary>
public sealed class StudioStateService(IStudioStateStore store)
{
    public Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct) =>
        store.GetAsync(workspaceId, ct);

    public Task<StudioStateWriteResult> PutAsync(
        Guid workspaceId,
        StudioState state,
        CancellationToken ct) =>
        store.PutAsync(workspaceId, state, ct);
}
