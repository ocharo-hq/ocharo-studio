using UzbekStudio.Persistence;

namespace UzbekStudio.Api.Configurations;

/// <summary>Startup initialization — creates the SQLite schema before the host starts serving.</summary>
public static class AppInitialization
{
    /// <summary>Creates the SQLite schema on boot.</summary>
    public static async Task InitializeAsync(this WebApplication app)
    {
        await app.Services.InitializeDatabaseAsync();
    }
}
