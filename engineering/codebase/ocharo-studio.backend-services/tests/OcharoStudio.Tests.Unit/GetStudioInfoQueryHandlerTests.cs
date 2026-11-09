using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using AwesomeAssertions;
using Xunit;

namespace OcharoStudio.Tests.Unit;

/// <summary>Protects the portable-document and browser-storage compatibility contract.</summary>
public sealed class GetStudioInfoQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_ReturnsSqliteSchemaTwoContract()
    {
        var result = await new GetStudioInfoQueryHandler()
            .HandleAsync(new GetStudioInfoQuery(), CancellationToken.None);

        result.Product.Should().Be("Ocharo Studio");
        result.DocumentSchemaVersion.Should().Be(2);
        result.Storage.Should().Be("sqlite");
        result.Capabilities.Should().Equal(["edit", "save", "import", "export"]);
    }
}
