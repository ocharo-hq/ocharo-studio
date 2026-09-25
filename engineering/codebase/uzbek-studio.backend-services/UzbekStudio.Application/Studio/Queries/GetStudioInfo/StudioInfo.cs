namespace UzbekStudio.Application.Studio.Queries.GetStudioInfo;

/// <summary>Defines the stable capability contract reported by the studio host.</summary>
/// <param name="Product">Human-readable product name.</param>
/// <param name="DocumentSchemaVersion">Current portable design-document schema version.</param>
/// <param name="Storage">Persistence boundary for saved designs.</param>
/// <param name="Capabilities">Supported design-document operations.</param>
public sealed record StudioInfo(
    string Product,
    int DocumentSchemaVersion,
    string Storage,
    IReadOnlyList<string> Capabilities);
