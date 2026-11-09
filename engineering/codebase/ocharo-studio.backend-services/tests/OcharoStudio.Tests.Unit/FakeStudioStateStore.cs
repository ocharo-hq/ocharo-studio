using System.Text.Json;
using OcharoStudio.Application.Studio.State;

namespace OcharoStudio.Tests.Unit;

/// <summary>An in-memory state store: reads <see cref="Current"/>, and answers a write with <see cref="NextWrite"/> when set,
/// else stores the state at the next revision.</summary>
internal sealed class FakeStudioStateStore : IStudioStateStore
{
    public StudioState Current { get; set; } = new(
        0, null, JsonSerializer.SerializeToElement(Array.Empty<object>()), JsonSerializer.SerializeToElement(new { }));

    public StudioStateWriteResult? NextWrite { get; set; }

    public Task<StudioState> GetAsync(Guid workspaceId, CancellationToken ct) => Task.FromResult(Current);

    public Task<StudioStateWriteResult> PutAsync(StudioWorkspace workspace, StudioState state, CancellationToken ct)
    {
        if (NextWrite is { } answer) return Task.FromResult(answer);
        Current = state with { Revision = state.Revision + 1 };
        return Task.FromResult(new StudioStateWriteResult(Current));
    }
}
