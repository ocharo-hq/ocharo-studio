namespace OcharoStudio.Api;

/// <summary>Immutable assembly identity assigned by CI; local builds report dev.</summary>
public static class BuildIdentity
{
    public static string Version => typeof(BuildIdentity).Assembly
        .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
        .OfType<System.Reflection.AssemblyInformationalVersionAttribute>().FirstOrDefault()?.InformationalVersion ?? "dev";
}
