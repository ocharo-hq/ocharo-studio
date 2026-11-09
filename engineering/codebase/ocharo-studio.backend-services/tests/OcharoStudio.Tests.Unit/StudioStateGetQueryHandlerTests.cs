using AwesomeAssertions;
using OcharoStudio.Application.Studio.Queries;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.QueryHandlers;
using OcharoStudio.Infrastructure.Studio.Services;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;
using Xunit;

namespace OcharoStudio.Tests.Unit;

/// <summary>Protects that a state read returns the stored state as it is; the read has no failure of its own.</summary>
public sealed class StudioStateGetQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_ShouldReturnTheStoredState()
    {
        var store = new FakeStudioStateStore();
        store.Current = store.Current with { Revision = 7 };
        var handler = new StudioStateGetQueryHandler(new StudioStateService(store, new FakeStudioThumbnailStore(enabled: false)));

        var result = await handler.HandleAsync(new StudioStateGetQuery { WorkspaceId = Guid.NewGuid() }, CancellationToken.None);

        result.Should().BeOfType<AppResult<StudioState>.Success>().Which.Data.Should().BeSameAs(store.Current);
    }
}
