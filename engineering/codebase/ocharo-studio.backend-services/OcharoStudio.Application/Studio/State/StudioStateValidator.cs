using System.Text;
using System.Text.Json;
using System.Globalization;
using System.Text.RegularExpressions;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Validates bounded portable studio documents before persistence.</summary>
public sealed class StudioStateValidator(StudioCatalogContract catalog)
{
    private const int MaxStateBytes = 4 * 1024 * 1024;
    private const int MaxSettingsBytes = 128 * 1024;
    private const int MaxThumbnailBytes = 1024 * 1024;
    private const int MaxLooks = 100;
    private const int MaxTextLength = 256;
    private const int MaxNameLength = 80;
    private const int MaxParts = 32;
    private const long MaxSafeInteger = 9_007_199_254_740_991;
    private static readonly string[] MaterialProperties = ["scale", "revision", "updatedAt"];
    private static readonly string[] DocumentProperties =
        ["schemaVersion", "assetVersion", "id", "name", "garmentId", "parts", "createdAt", "updatedAt"];
    private static readonly string[] SchemaOnePlacementProperties = ["rotation", "offsetX", "offsetY"];
    private static readonly string[] SchemaTwoPlacementProperties =
        ["rotation", "offsetX", "offsetY", "scale", "materialAnchorX", "materialAnchorY", "garmentAnchorX", "garmentAnchorY"];

    public IReadOnlyList<string> Validate(StudioState state)
    {
        var errors = new List<string>();
        if (state.Revision < 0) errors.Add("revision must be non-negative.");
        var materialScales = ValidateMaterials(state.Materials, errors);
        if (state.Draft is { } draft && !IsNull(draft))
            ValidateDocument(draft, "draft", materialScales, errors);

        if (state.Looks.ValueKind != JsonValueKind.Array)
        {
            errors.Add("looks must be an array.");
        }
        else
        {
            var looks = state.Looks.EnumerateArray().ToArray();
            if (looks.Length > MaxLooks) errors.Add($"looks cannot contain more than {MaxLooks} items.");
            for (var index = 0; index < Math.Min(looks.Length, MaxLooks + 1); index++)
                ValidateLook(looks[index], index, materialScales, errors);
        }

        if (state.Settings.ValueKind != JsonValueKind.Object)
            errors.Add("settings must be an object.");
        else if (SizeOf(state.Settings) > MaxSettingsBytes)
            errors.Add("settings exceeds 128 KiB.");

        if (SizeOfState(state) > MaxStateBytes)
            errors.Add("studio state exceeds 4 MiB.");
        return errors;
    }

    private IReadOnlyDictionary<string, double> ValidateMaterials(
        JsonElement? materials,
        List<string> errors)
    {
        var scales = new Dictionary<string, double>(StringComparer.Ordinal);
        if (materials is null || IsNull(materials.Value)) return scales;
        if (materials.Value.ValueKind != JsonValueKind.Object)
        {
            errors.Add("materials must be an object.");
            return scales;
        }

        var entries = materials.Value.EnumerateObject().ToArray();
        if (entries.Length > catalog.MaterialCount)
            errors.Add($"materials cannot contain more than {catalog.MaterialCount} entries.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var material in entries)
        {
            var path = $"materials.{material.Name}";
            if (!ids.Add(material.Name))
                errors.Add($"{path} is duplicated.");
            if (!catalog.IsKnownMaterial(material.Name))
                errors.Add($"{path} is not in the catalog.");
            if (material.Value.ValueKind != JsonValueKind.Object)
            {
                errors.Add($"{path} must be an object.");
                continue;
            }
            if (!HasExactlyOneOfEachProperty(material.Value, MaterialProperties))
                errors.Add($"{path} must contain each supported property exactly once.");

            ValidateNumber(material.Value, "scale", .25, 4, path, true, errors);
            if (material.Value.TryGetProperty("scale", out var scale) &&
                scale.TryGetDouble(out var scaleValue) &&
                double.IsFinite(scaleValue) && scaleValue is >= .25 and <= 4)
                scales.TryAdd(material.Name, scaleValue);
            if (!material.Value.TryGetProperty("revision", out var revision) ||
                revision.ValueKind != JsonValueKind.Number ||
                !revision.TryGetInt64(out var revisionValue) ||
                revisionValue is < 1 or > MaxSafeInteger)
                errors.Add($"{path}.revision must be a positive safe integer.");
            RequireTimestamp(material.Value, "updatedAt", path, errors);
        }
        return scales;
    }

    private void ValidateLook(
        JsonElement look,
        int index,
        IReadOnlyDictionary<string, double> materialScales,
        List<string> errors)
    {
        var path = $"looks[{index}]";
        if (look.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{path} must be an object.");
            return;
        }
        if (!HasOnlyProperties(look, "document", "thumbnail"))
            errors.Add($"{path} contains unsupported properties.");

        if (!look.TryGetProperty("document", out var document))
            errors.Add($"{path}.document is required.");
        else
            ValidateDocument(document, $"{path}.document", materialScales, errors);

        if (look.TryGetProperty("thumbnail", out var thumbnail) &&
            thumbnail.ValueKind != JsonValueKind.Null &&
            (thumbnail.ValueKind != JsonValueKind.String ||
             Encoding.UTF8.GetByteCount(thumbnail.GetString() ?? "") > MaxThumbnailBytes))
            errors.Add($"{path}.thumbnail must be a string no larger than 1 MiB.");
    }

    private void ValidateDocument(
        JsonElement document,
        string path,
        IReadOnlyDictionary<string, double> materialScales,
        List<string> errors)
    {
        if (document.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{path} must be an object.");
            return;
        }

        if (!TryInt(document, "schemaVersion", out var schema) || schema is not (1 or 2))
            errors.Add($"{path}.schemaVersion must be 1 or 2.");
        if (!HasOnlyProperties(document, DocumentProperties))
            errors.Add($"{path} contains unsupported properties.");
        RequireId(document, "id", path, errors);
        RequireName(document, "name", path, errors);
        var garmentId = RequireSlug(document, "garmentId", path, errors);
        RequireTimestamp(document, "createdAt", path, errors);
        RequireTimestamp(document, "updatedAt", path, errors);

        if (!document.TryGetProperty("assetVersion", out var assetVersion) ||
            assetVersion.ValueKind != JsonValueKind.Number ||
            !assetVersion.TryGetInt32(out var version) || version != 1)
            errors.Add($"{path}.assetVersion must be 1.");

        if (!document.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{path}.parts must be an object.");
            return;
        }
        if (parts.GetPropertyCount() is 0 or > MaxParts)
            errors.Add($"{path}.parts must contain between 1 and {MaxParts} assignments.");

        StudioCatalogContract.GarmentContract? garment = null;
        if (garmentId is not null && !catalog.TryGetGarment(garmentId, out garment))
            errors.Add($"{path}.garmentId is not in the catalog.");
        if (garment is not null)
        {
            var actualParts = parts.EnumerateObject()
                .Select(part => part.Name)
                .ToHashSet(StringComparer.Ordinal);
            if (!actualParts.SetEquals(garment.Parts.Keys))
                errors.Add($"{path}.parts must exactly match the selected garment.");
        }

        foreach (var part in parts.EnumerateObject())
        {
            if (!IsSlug(part.Name))
            {
                errors.Add($"{path}.parts contains an invalid part id.");
                continue;
            }
            IReadOnlySet<string>? allowedMaterials = null;
            garment?.Parts.TryGetValue(part.Name, out allowedMaterials);
            ValidateAssignment(
                part.Value,
                $"{path}.parts.{part.Name}",
                schema,
                allowedMaterials,
                materialScales,
                errors);
        }
    }

    private void ValidateAssignment(
        JsonElement assignment,
        string path,
        int schema,
        IReadOnlySet<string>? allowedMaterials,
        IReadOnlyDictionary<string, double> materialScales,
        List<string> errors)
    {
        if (assignment.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{path} must be an object.");
            return;
        }
        if (!HasOnlyProperties(assignment, "materialId", "placement"))
            errors.Add($"{path} contains unsupported properties.");
        var materialId = RequireSlug(assignment, "materialId", path, errors);
        if (materialId is not null && !catalog.IsKnownMaterial(materialId))
            errors.Add($"{path}.materialId is not in the catalog.");
        else if (schema == 2 && materialId is not null &&
                 allowedMaterials is not null && !allowedMaterials.Contains(materialId))
            errors.Add($"{path}.materialId is not allowed for this garment part.");
        if (!assignment.TryGetProperty("placement", out var placement) ||
            placement.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{path}.placement must be an object.");
            return;
        }
        var placementProperties = schema == 2
            ? SchemaTwoPlacementProperties
            : SchemaOnePlacementProperties;
        if (!HasOnlyProperties(placement, placementProperties))
            errors.Add($"{path}.placement contains unsupported properties.");

        var placementPath = $"{path}.placement";
        ValidateNumber(placement, "rotation", -180, 180, placementPath, true, errors);
        ValidateNumber(placement, "offsetX", -1, 1, placementPath, true, errors);
        ValidateNumber(placement, "offsetY", -1, 1, placementPath, true, errors);
        ValidateNumber(placement, "scale", .25, 4, placementPath, schema == 2, errors);
        ValidateNumber(placement, "materialAnchorX", 0, 1, placementPath, schema == 2, errors);
        ValidateNumber(placement, "materialAnchorY", 0, 1, placementPath, schema == 2, errors);
        ValidateNumber(placement, "garmentAnchorX", 0, 1, placementPath, schema == 2, errors);
        ValidateNumber(placement, "garmentAnchorY", 0, 1, placementPath, schema == 2, errors);
        if (schema == 2 && materialId is not null &&
            materialScales.TryGetValue(materialId, out var sharedScale) &&
            placement.TryGetProperty("scale", out var bakedScale) &&
            bakedScale.TryGetDouble(out var bakedScaleValue) && bakedScaleValue != sharedScale)
            errors.Add($"{path}.placement.scale must match materials.{materialId}.scale.");
    }

    private static void ValidateNumber(
        JsonElement parent,
        string name,
        double minimum,
        double maximum,
        string path,
        bool required,
        List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value))
        {
            if (required) errors.Add($"{path}.{name} is required.");
            return;
        }
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var number) ||
            !double.IsFinite(number) || number < minimum || number > maximum)
            errors.Add($"{path}.{name} must be between {minimum} and {maximum}.");
    }

    private static void RequireText(JsonElement parent, string name, string path, List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(value.GetString()) ||
            value.GetString()!.Length > MaxTextLength)
            errors.Add($"{path}.{name} must be a non-empty string no longer than {MaxTextLength} characters.");
    }

    private static void RequireId(JsonElement parent, string name, string path, List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            !Guid.TryParseExact(value.GetString(), "D", out var id) ||
            id == Guid.Empty)
            errors.Add($"{path}.{name} must be a non-empty UUID.");
    }

    private static void RequireName(JsonElement parent, string name, string path, List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            errors.Add($"{path}.{name} is required.");
            return;
        }
        var text = value.GetString()!;
        if (text.Length is 0 or > MaxNameLength || text.Trim() != text)
            errors.Add($"{path}.{name} must be trimmed and contain at most {MaxNameLength} characters.");
    }

    private static string? RequireSlug(
        JsonElement parent,
        string name,
        string path,
        List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            !IsSlug(value.GetString()))
        {
            errors.Add($"{path}.{name} must be a lowercase identifier.");
            return null;
        }
        return value.GetString();
    }

    private static void RequireTimestamp(JsonElement parent, string name, string path, List<string> errors)
    {
        if (!parent.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            !DateTimeOffset.TryParseExact(
                value.GetString(),
                "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal,
                out _))
            errors.Add($"{path}.{name} must be an ISO UTC timestamp with milliseconds.");
    }

    private static bool IsSlug(string? value) =>
        value is { Length: > 0 and <= MaxTextLength } &&
        Regex.IsMatch(value, "^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant);

    private static bool TryInt(JsonElement parent, string name, out int value)
    {
        value = default;
        return parent.TryGetProperty(name, out var element) &&
            element.ValueKind == JsonValueKind.Number &&
            element.TryGetInt32(out value);
    }

    private static bool IsNull(JsonElement value) =>
        value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined;

    private static bool HasOnlyProperties(JsonElement value, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        return value.EnumerateObject().All(property => allowed.Contains(property.Name));
    }

    private static bool HasExactlyOneOfEachProperty(JsonElement value, params string[] names)
    {
        var properties = value.EnumerateObject().Select(property => property.Name).ToArray();
        return properties.Length == names.Length &&
            properties.Distinct(StringComparer.Ordinal).Count() == names.Length &&
            properties.All(names.Contains);
    }

    private static int SizeOf(JsonElement value) =>
        value.ValueKind == JsonValueKind.Undefined
            ? 0
            : Encoding.UTF8.GetByteCount(value.GetRawText());

    private static long SizeOfState(StudioState state) =>
        (state.Draft is { } draft && !IsNull(draft) ? SizeOf(draft) : 4L) +
        SizeOf(state.Looks) + SizeOf(state.Settings) +
        (state.Materials is { } materials && !IsNull(materials) ? SizeOf(materials) : 2L);
}
