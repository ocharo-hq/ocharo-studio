
namespace OcharoStudio.Api;

/// <summary>Immutable assembly identity assigned by CI; local builds report dev.</summary>
public static class BuildIdentity
{
    public static string Version => typeof(BuildIdentity).Assembly
        .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
        .OfType<System.Reflection.AssemblyInformationalVersionAttribute>().FirstOrDefault()?.InformationalVersion ?? "dev";

    /// <summary>The product version without its source revision, such as <c>0.1.13</c>, or <c>dev</c>.</summary>
    public static string ProductVersion => Version.Split('+')[0];

    /// <summary>The label stamped on each migration this image applies.</summary>
    public static string MigrationVersion => $"v{ProductVersion}";

    /// <summary>The release a contract's <c>since</c> compares with; a local build counts as <c>0.0.0</c>.</summary>
    public static string MigrationRelease =>
        System.Text.RegularExpressions.Regex.IsMatch(ProductVersion, @"^\d+\.\d+\.\d+") ? ProductVersion : "0.0.0";
}
