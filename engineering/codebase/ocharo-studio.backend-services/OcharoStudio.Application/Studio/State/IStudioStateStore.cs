namespace OcharoStudio.Application.Studio.State;

/// <summary>Reads and atomically replaces isolated studio workspace state.</summary>
public interface IStudioStateStore
{
    Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct);

    /// <summary>Replaces the workspace's state when <see cref="StudioState.Revision"/> is current, recording its owner.</summary>
    Task<StudioStateWriteResult> PutAsync(StudioWorkspace workspace, StudioState state, CancellationToken ct);
}
