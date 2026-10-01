using OcharoStudio.Application.Studio.Queries.GetStudioInfo;
using Xunit;

namespace OcharoStudio.Tests;

/// <summary>Protects the portable-document and browser-storage compatibility contract.</summary>
public sealed class GetStudioInfoQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_ReturnsSqliteSchemaTwoContract()
    {
        var result = await new GetStudioInfoQueryHandler()
            .HandleAsync(new GetStudioInfoQuery(), CancellationToken.None);

        Assert.Equal("Ocharo Studio", result.Product);
        Assert.Equal(2, result.DocumentSchemaVersion);
        Assert.Equal("sqlite", result.Storage);
        Assert.Equal(["edit", "save", "import", "export"], result.Capabilities);
    }
}
