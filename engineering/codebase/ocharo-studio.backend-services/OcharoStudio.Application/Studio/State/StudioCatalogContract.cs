using System.Reflection;
using System.Text.Json;
using WoW.Two.Sdk.Backend.Beta.Foundation.Serialization;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Provides the generated garment, part, and material compatibility contract.</summary>
public sealed class StudioCatalogContract
{
    private const string ResourceName =
        "OcharoStudio.Application.Studio.State.catalog-contract.json";
    private static readonly Lazy<StudioCatalogContract> Embedded =
        new(LoadResource, LazyThreadSafetyMode.ExecutionAndPublication);
    private readonly IReadOnlyDictionary<string, GarmentContract> garments;
    private readonly IReadOnlySet<string> materialIds;

    private StudioCatalogContract(CatalogDocument document)
    {
        materialIds = document.MaterialIds.ToHashSet(StringComparer.Ordinal);
        garments = document.Garments.ToDictionary(
            garment => garment.Id,
            garment => new GarmentContract(
                garment.Parts.ToDictionary(
                    part => part.Id,
                    part => (IReadOnlySet<string>)part.MaterialIds.ToHashSet(StringComparer.Ordinal),
                    StringComparer.Ordinal)),
            StringComparer.Ordinal);
    }

    public static StudioCatalogContract LoadEmbedded() => Embedded.Value;

    public bool IsKnownMaterial(string materialId) => materialIds.Contains(materialId);

    public int MaterialCount => materialIds.Count;

    public bool TryGetGarment(string garmentId, out GarmentContract garment) =>
        garments.TryGetValue(garmentId, out garment!);

    private static StudioCatalogContract LoadResource()
    {
        using var stream = typeof(StudioCatalogContract).Assembly
            .GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{ResourceName}' is missing.");
        var document = JsonSerializer.Deserialize<CatalogDocument>(
            stream,
            StoredJsonConstants.Default)
            ?? throw new InvalidDataException("The embedded studio catalog contract is empty.");
        if (document.Garments.Count == 0 || document.MaterialIds.Count == 0)
            throw new InvalidDataException("The embedded studio catalog contract has no catalog entries.");
        return new StudioCatalogContract(document);
    }

    public sealed record GarmentContract(
        IReadOnlyDictionary<string, IReadOnlySet<string>> Parts);

    private sealed record CatalogDocument(
        IReadOnlyList<GarmentDocument> Garments,
        IReadOnlyList<string> MaterialIds);

    private sealed record GarmentDocument(
        string Id,
        IReadOnlyList<PartDocument> Parts);

    private sealed record PartDocument(
        string Id,
        IReadOnlyList<string> MaterialIds);
}
