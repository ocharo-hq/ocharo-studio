using UzbekStudio.Application.Studio.Queries.GetStudioInfo;
using Xunit;

namespace UzbekStudio.Tests;

/// <summary>Protects the portable-document and browser-storage compatibility contract.</summary>
public sealed class GetStudioInfoQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_ReturnsStableBrowserLocalContract()
    {
        var result = await new GetStudioInfoQueryHandler()
            .HandleAsync(new GetStudioInfoQuery(), CancellationToken.None);

        Assert.Equal("Uzbek Studio", result.Product);
        Assert.Equal(1, result.DocumentSchemaVersion);
        Assert.Equal("browser-local", result.Storage);
        Assert.Equal(["edit", "save", "import", "export"], result.Capabilities);
    }
}
