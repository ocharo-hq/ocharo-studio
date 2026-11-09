using System.Text.Json;
using AwesomeAssertions;
using OcharoStudio.Application.Studio.Commands;
using OcharoStudio.Application.Studio.Errors;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Infrastructure.Studio.CommandHandlers;
using OcharoStudio.Infrastructure.Studio.Services;
using OcharoStudio.Infrastructure.Studio.Validators;
using WoW.Two.Sdk.Beta.Be.Foundation.Errors;
using WoW.Two.Sdk.Beta.Be.Foundation.Validation;
using WoW.Two.Sdk.Beta.Be.Mediator.Result;
using Xunit;

namespace OcharoStudio.Tests.Unit;

/// <summary>Protects how a state save maps each refusal to its catalogue error, the field keys and messages included.</summary>
public sealed class StudioStateReplaceCommandHandlerTests
{
    private static readonly StudioWorkspace Workspace = StudioWorkspace.For(Guid.NewGuid(), "member");

    [Fact]
    public async Task HandleAsync_ShouldReportEachValidationMessageUnderState_WhenTheStateIsInvalid()
    {
        var store = new FakeStudioStateStore();

        var result = await Handler(store).HandleAsync(Command(EmptyState() with { Revision = -1 }), CancellationToken.None);

        var failures = Validation(result);
        failures.Should().NotBeEmpty().And.OnlyContain(failure => failure.Property == "state");
        failures.Should().Contain(failure => failure.Message == "revision must be non-negative.");
    }

    [Fact]
    public async Task HandleAsync_ShouldReportTheThumbnailField_WhenTheStoreRefusesAnUnknownThumbnail()
    {
        var store = new FakeStudioStateStore { NextWrite = new StudioStateWriteResult(null, StudioStateWriteFailure.ThumbnailUnknown) };

        var result = await Handler(store).HandleAsync(Command(EmptyState()), CancellationToken.None);

        Validation(result).Should().ContainSingle().Which.Should().Match<FieldError>(failure =>
            failure.Property == "thumbnail" && failure.Message == "A thumbnail link names a file this workspace does not hold.");
    }

    [Fact]
    public async Task HandleAsync_ShouldReportTheMaterialsField_WhenTheStoreRequiresMaterials()
    {
        var store = new FakeStudioStateStore { NextWrite = new StudioStateWriteResult(null, StudioStateWriteFailure.MaterialsRequired) };

        var result = await Handler(store).HandleAsync(Command(EmptyState()), CancellationToken.None);

        Validation(result).Should().ContainSingle().Which.Should().Match<FieldError>(failure =>
            failure.Property == "materials" && failure.Message == "Material metadata is required. Reload or upgrade the studio before saving.");
    }

    [Fact]
    public async Task HandleAsync_ShouldReportARevisionConflict_WhenTheStoreKeepsANewerRevision()
    {
        var store = new FakeStudioStateStore { NextWrite = new StudioStateWriteResult(null, StudioStateWriteFailure.RevisionConflict) };

        var result = await Handler(store).HandleAsync(Command(EmptyState()), CancellationToken.None);

        var error = Failure(result);
        error.Type.Should().Be(AppErrorType.Conflict);
        error.Message.Should().Be("Revision conflict");
    }

    [Theory]
    [InlineData(400, AppErrorType.Validation, false)]
    [InlineData(404, AppErrorType.NotFound, false)]
    [InlineData(503, AppErrorType.ExternalUnavailable, false)]
    [InlineData(502, AppErrorType.ExternalUnavailable, true)]
    public async Task HandleAsync_ShouldMapAFilesRefusalByItsStatus_WhenANewThumbnailCannotBeStored(int status, AppErrorType type, bool refused)
    {
        var thumbnails = new FakeStudioThumbnailStore { Refusal = new StudioFilesException("Files said no.", status) };
        var state = EmptyState() with { Looks = JsonSerializer.SerializeToElement(new[] { LookWithNewThumbnail() }) };

        var result = await Handler(new FakeStudioStateStore(), thumbnails).HandleAsync(Command(state), CancellationToken.None);

        var error = Failure(result);
        error.Type.Should().Be(type);
        error.Message.Should().Be("Files said no.");
        (error.Metadata?.ContainsKey(StudioErrors.FilesRefusedKey) == true).Should().Be(refused);
    }

    [Fact]
    public async Task HandleAsync_ShouldReturnTheStoredState_WhenTheRevisionIsCurrent()
    {
        var store = new FakeStudioStateStore();

        var result = await Handler(store).HandleAsync(Command(EmptyState()), CancellationToken.None);

        result.Should().BeOfType<AppResult<StudioState>.Success>().Which.Data.Revision.Should().Be(1);
    }

    private static StudioStateReplaceCommandHandler Handler(FakeStudioStateStore store, FakeStudioThumbnailStore? thumbnails = null) =>
        new(new StudioStateService(store, thumbnails ?? new FakeStudioThumbnailStore(enabled: false)),
            new StudioStateValidator(StudioCatalogContract.LoadEmbedded()));

    private static StudioStateReplaceCommand Command(StudioState state) => new() { Workspace = Workspace, State = state };

    private static StudioState EmptyState() => new(
        0, null, JsonSerializer.SerializeToElement(Array.Empty<object>()), JsonSerializer.SerializeToElement(new { }));

    private static AppError Failure(AppResult<StudioState> result) =>
        result.Should().BeOfType<AppResult<StudioState>.Failure>().Which.Error;

    private static IReadOnlyList<FieldError> Validation(AppResult<StudioState> result) =>
        Failure(result).Should().BeOfType<ValidationError>().Which.Failures;

    /// <summary>A valid look whose thumbnail is a WebP data URL the state does not hold yet, so a save stores it.</summary>
    private static object LookWithNewThumbnail() => new
    {
        document = new
        {
            schemaVersion = 1,
            assetVersion = 1,
            id = "0c645d1c-576a-43b8-a8d2-000000000001",
            name = "Look",
            garmentId = "nimcha",
            createdAt = "2026-09-25T00:00:00.000Z",
            updatedAt = "2026-09-25T00:00:00.000Z",
            parts = new Dictionary<string, object>
            {
                ["body"] = Assignment("catalogue-synthetic-poplin-paisley-ivory-on-black"),
                ["collar"] = Assignment("pomegranate"),
                ["trim"] = Assignment("pomegranate"),
                ["belt"] = Assignment("pomegranate"),
            },
        },
        thumbnail = "data:image/webp;base64," + Convert.ToBase64String([.. "RIFF"u8, 0, 0, 0, 0, .. "WEBP"u8, .. "a"u8]),
    };

    private static object Assignment(string materialId) => new { materialId, placement = new { rotation = 0, offsetX = 0, offsetY = 0 } };
}
