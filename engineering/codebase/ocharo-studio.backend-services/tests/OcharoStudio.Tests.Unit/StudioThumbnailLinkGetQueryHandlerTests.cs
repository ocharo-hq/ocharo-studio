using System.Text.Json;
using AwesomeAssertions;
using OcharoStudio.Application.Studio.Errors;
using OcharoStudio.Application.Studio.Queries;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.QueryHandlers;
using OcharoStudio.Infrastructure.Studio.Services;
using WoW.Two.Sdk.Beta.Be.Foundation.Errors;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;
using Xunit;

namespace OcharoStudio.Tests.Unit;

/// <summary>Protects which thumbnail links resolve: only one the workspace holds, while Files stores thumbnails, mapping a
/// Files refusal by its status.</summary>
public sealed class StudioThumbnailLinkGetQueryHandlerTests
{
    private static readonly string Sha256 = new('a', 64);
    private static readonly Guid FileId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ShouldReportNotFound_WhenThumbnailsAreNotInFiles()
    {
        var result = await Handler(HoldingStore(), new FakeStudioThumbnailStore(enabled: false)).HandleAsync(Query(), CancellationToken.None);

        Failure(result).Type.Should().Be(AppErrorType.NotFound);
    }

    [Fact]
    public async Task HandleAsync_ShouldReportNotFound_WhenTheWorkspaceDoesNotHoldTheThumbnail()
    {
        var result = await Handler(new FakeStudioStateStore(), new FakeStudioThumbnailStore()).HandleAsync(Query(), CancellationToken.None);

        Failure(result).Type.Should().Be(AppErrorType.NotFound);
    }

    [Fact]
    public async Task HandleAsync_ShouldReportNotFound_WhenTheFileIsGoneFromFiles()
    {
        var result = await Handler(HoldingStore(), new FakeStudioThumbnailStore { Link = null }).HandleAsync(Query(), CancellationToken.None);

        Failure(result).Type.Should().Be(AppErrorType.NotFound);
    }

    [Theory]
    [InlineData(400, AppErrorType.Validation)]
    [InlineData(404, AppErrorType.NotFound)]
    [InlineData(503, AppErrorType.ExternalUnavailable)]
    [InlineData(502, AppErrorType.ExternalRejected)]
    public async Task HandleAsync_ShouldMapAFilesRefusalByItsStatus_WhenTheLinkIsRefused(int status, AppErrorType type)
    {
        var thumbnails = new FakeStudioThumbnailStore { Refusal = new StudioFilesException("Files said no.", status) };

        var result = await Handler(HoldingStore(), thumbnails).HandleAsync(Query(), CancellationToken.None);

        var error = Failure(result);
        error.Type.Should().Be(type);
        error.Message.Should().Be("Files said no.");
    }

    [Fact]
    public async Task HandleAsync_ShouldReturnTheFilesLink_WhenTheWorkspaceHoldsTheThumbnail()
    {
        var thumbnails = new FakeStudioThumbnailStore();

        var result = await Handler(HoldingStore(), thumbnails).HandleAsync(Query(), CancellationToken.None);

        result.Should().BeOfType<AppResult<Uri>.Success>().Which.Data.Should().Be(thumbnails.Link);
    }

    private static StudioThumbnailLinkGetQueryHandler Handler(FakeStudioStateStore store, FakeStudioThumbnailStore thumbnails) =>
        new(new StudioStateService(store, thumbnails), thumbnails);

    private static StudioThumbnailLinkGetQuery Query() => new() { WorkspaceId = Guid.NewGuid(), Sha256 = Sha256, FileId = FileId };

    private static FakeStudioStateStore HoldingStore() => new()
    {
        Current = new StudioState(
            1, null,
            JsonSerializer.SerializeToElement(new[] { new { thumbnail = StudioThumbnailRoute.Url(Sha256, FileId) } }),
            JsonSerializer.SerializeToElement(new { })),
    };

    private static AppError Failure(AppResult<Uri> result) =>
        result.Should().BeOfType<AppResult<Uri>.Failure>().Which.Error;
}
