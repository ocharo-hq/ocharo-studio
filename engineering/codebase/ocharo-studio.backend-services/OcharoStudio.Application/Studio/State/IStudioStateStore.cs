namespace OcharoStudio.Application.Studio.State;

/// <summary>Reads and atomically replaces isolated studio workspace state.</summary>
public interface IStudioStateStore
{
    Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct);

    Task<StudioStateWriteResult> PutAsync(Guid workspaceId, StudioState state, CancellationToken ct);
}
