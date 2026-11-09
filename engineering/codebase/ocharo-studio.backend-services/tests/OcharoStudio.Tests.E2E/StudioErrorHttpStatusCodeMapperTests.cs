using AwesomeAssertions;
using OcharoStudio.Application.Studio.Errors;
using OcharoStudio.Application.Studio.State;
using OcharoStudio.Api.Studio.Errors;
using Xunit;

namespace OcharoStudio.Tests.E2E;

/// <summary>Protects the HTTP status each Studio catalogue error answers with, as the state routes answered before the mediator.</summary>
public sealed class StudioErrorHttpStatusCodeMapperTests
{
    private static readonly StudioErrorHttpStatusCodeMapper Mapper = new();

    [Theory]
    [InlineData(400)]
    [InlineData(404)]
    [InlineData(502)]
    [InlineData(503)]
    public void ToStatusCode_ShouldKeepTheStatusOfAFilesFailure(int status)
    {
        Mapper.ToStatusCode(StudioErrors.FilesFailed(new StudioFilesException("Files said no.", status))).Should().Be(status);
    }

    [Fact]
    public void ToStatusCode_ShouldAnswerStateErrorsAsBefore()
    {
        Mapper.ToStatusCode(StudioErrors.StateInvalid(["revision must be non-negative."])).Should().Be(400);
        Mapper.ToStatusCode(StudioErrors.ThumbnailUnknown()).Should().Be(400);
        Mapper.ToStatusCode(StudioErrors.MaterialsRequired()).Should().Be(400);
        Mapper.ToStatusCode(StudioErrors.RevisionConflict()).Should().Be(409);
        Mapper.ToStatusCode(StudioErrors.ThumbnailNotFound()).Should().Be(404);
    }
}
