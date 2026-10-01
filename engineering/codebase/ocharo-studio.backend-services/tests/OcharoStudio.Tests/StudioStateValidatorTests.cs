using System.Text.Json;
using OcharoStudio.Application.Studio.State;
using Xunit;

namespace OcharoStudio.Tests;

/// <summary>Protects document placement and collection bounds at the application boundary.</summary>
public sealed class StudioStateValidatorTests
{
    private static readonly StudioStateValidator Validator =
        new(StudioCatalogContract.LoadEmbedded());

    [Fact]
    public void Validate_ShouldRejectOutOfRangeSchemaTwoPlacement()
    {
        var draft = JsonSerializer.SerializeToElement(new
        {
            schemaVersion = 2,
            assetVersion = 1,
            id = "0c645d1c-576a-43b8-a8d2-b75eb892014d",
            name = "Draft",
            garmentId = "nimcha",
            createdAt = "2026-09-25T00:00:00Z",
            updatedAt = "2026-09-25T00:00:00Z",
            parts = new
            {
                body = new
                {
                    materialId = "adras",
                    placement = new
                    {
                        rotation = 181,
                        offsetX = 0,
                        offsetY = 0,
                        scale = 1,
                        materialAnchorX = .5,
                        materialAnchorY = .5,
                        garmentAnchorX = .5,
                        garmentAnchorY = .5
                    }
                }
            }
        });
        var state = new StudioState(
            0,
            draft,
            JsonSerializer.SerializeToElement(Array.Empty<object>()),
            JsonSerializer.SerializeToElement(new { }));

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains("rotation", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldRejectDocumentIdentityThatFrontendCannotRead()
    {
        var draft = JsonSerializer.SerializeToElement(new
        {
            schemaVersion = 2,
            assetVersion = 1,
            id = "not-a-uuid",
            name = " Draft ",
            garmentId = "Nimcha",
            createdAt = "yesterday",
            updatedAt = "2026-09-25T00:00:00.000Z",
            parts = new
            {
                body = new
                {
                    materialId = "Adras Indigo",
                    placement = new
                    {
                        rotation = 0,
                        offsetX = 0,
                        offsetY = 0,
                        scale = 1,
                        materialAnchorX = .5,
                        materialAnchorY = .5,
                        garmentAnchorX = .5,
                        garmentAnchorY = .5
                    }
                }
            }
        });
        var state = new StudioState(
            0,
            draft,
            JsonSerializer.SerializeToElement(Array.Empty<object>()),
            JsonSerializer.SerializeToElement(new { }));

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains(".id", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains(".name", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains(".garmentId", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains(".createdAt", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains(".materialId", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldRejectSchemaTwoMaterialUnavailableForPart()
    {
        var errors = Validator.Validate(StateWith(NimchaDocument(2, "catalogue-synthetic-poplin-paisley-ivory-on-black")));

        Assert.Contains(
            errors,
            error => error.Contains("not allowed for this garment part", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldAcceptKnownLegacyMaterialOutsideCurrentPartRules()
    {
        var errors = Validator.Validate(StateWith(NimchaDocument(1, "gold")));

        Assert.DoesNotContain(errors, error => error.Contains("materialId", StringComparison.Ordinal));
        Assert.DoesNotContain(errors, error => error.Contains(".parts", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldRejectUnknownGarmentAndPartMismatch()
    {
        var document = NimchaDocument(2, "atlas-rose");
        var changed = JsonSerializer.Deserialize<Dictionary<string, object>>(document.GetRawText())!;
        changed["garmentId"] = "future-garment";
        var state = StateWith(JsonSerializer.SerializeToElement(changed));

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains("garmentId is not in the catalog", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldAcceptBoundedKnownMaterialMetadata()
    {
        var state = StateWith(
            NimchaDocument(2, "catalogue-atlas-paisley-ivory-on-black", 1.25),
            new Dictionary<string, object>
            {
                ["catalogue-atlas-paisley-ivory-on-black"] = new
                {
                    scale = 1.25,
                    revision = 2,
                    updatedAt = "2026-09-25T00:00:00.000Z"
                }
            });

        Assert.Empty(Validator.Validate(state));
    }

    [Fact]
    public void Validate_ShouldRejectMismatchedSharedMaterialProjection()
    {
        var state = StateWith(
            NimchaDocument(2, "catalogue-atlas-paisley-ivory-on-black", 1),
            new Dictionary<string, object>
            {
                ["catalogue-atlas-paisley-ivory-on-black"] = new
                {
                    scale = 1.25,
                    revision = 2,
                    updatedAt = "2026-09-25T00:00:00.000Z"
                }
            });

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains("must match", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldRejectDuplicateMaterialIdsAndProperties()
    {
        using var duplicateJson = JsonDocument.Parse(
            """
            {
              "catalogue-atlas-paisley-ivory-on-black": {
                "scale": 1, "scale": 1, "revision": 1,
                "updatedAt": "2026-09-25T00:00:00.000Z"
              },
              "catalogue-atlas-paisley-ivory-on-black": {
                "scale": 1, "revision": 1,
                "updatedAt": "2026-09-25T00:00:00.000Z"
              }
            }
            """);
        var state = StateWith(
            NimchaDocument(2, "catalogue-atlas-paisley-ivory-on-black")) with
        {
            Materials = duplicateJson.RootElement.Clone()
        };

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains("duplicated", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("exactly once", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldBoundMaterialMetadataByCatalogueSize()
    {
        var catalog = StudioCatalogContract.LoadEmbedded();
        var materials = Enumerable.Range(0, catalog.MaterialCount + 1).ToDictionary(
            index => $"unknown-{index}",
            _ => (object)new
            {
                scale = 1,
                revision = 1,
                updatedAt = "2026-09-25T00:00:00.000Z"
            });
        var state = new StudioState(
            0,
            null,
            JsonSerializer.SerializeToElement(Array.Empty<object>()),
            JsonSerializer.SerializeToElement(new { }),
            JsonSerializer.SerializeToElement(materials));

        var errors = Validator.Validate(state);

        Assert.Contains(
            errors,
            error => error.Contains($"more than {catalog.MaterialCount} entries", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_ShouldRejectInvalidOrUnknownMaterialMetadata()
    {
        var state = StateWith(
            NimchaDocument(2, "adras"),
            new Dictionary<string, object>
            {
                ["future-material"] = new
                {
                    scale = 4.01,
                    revision = 9_007_199_254_740_992L,
                    updatedAt = "2026-09-25T00:00:00Z",
                    extra = true
                }
            });

        var errors = Validator.Validate(state);

        Assert.Contains(errors, error => error.Contains("not in the catalog", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("exactly once", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains(".scale", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("positive safe integer", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("milliseconds", StringComparison.Ordinal));
    }

    private static StudioState StateWith(JsonElement draft, object? materials = null) => new(
        0,
        draft,
        JsonSerializer.SerializeToElement(Array.Empty<object>()),
        JsonSerializer.SerializeToElement(new { }),
        materials is null ? null : JsonSerializer.SerializeToElement(materials));

    private static JsonElement NimchaDocument(int schema, string bodyMaterial, double scale = 1)
    {
        var placement = schema == 1
            ? new Dictionary<string, object>
            {
                ["rotation"] = 0,
                ["offsetX"] = 0,
                ["offsetY"] = 0
            }
            : new Dictionary<string, object>
            {
                ["rotation"] = 0,
                ["offsetX"] = 0,
                ["offsetY"] = 0,
                ["scale"] = scale,
                ["materialAnchorX"] = .5,
                ["materialAnchorY"] = .5,
                ["garmentAnchorX"] = .5,
                ["garmentAnchorY"] = .5
            };
        object Assignment(string materialId) => new
        {
            materialId,
            placement
        };
        return JsonSerializer.SerializeToElement(new
        {
            schemaVersion = schema,
            assetVersion = 1,
            id = "0c645d1c-576a-43b8-a8d2-b75eb892014d",
            name = "Draft",
            garmentId = "nimcha",
            createdAt = "2026-09-25T00:00:00.000Z",
            updatedAt = "2026-09-25T00:00:00.000Z",
            parts = new Dictionary<string, object>
            {
                ["body"] = Assignment(bodyMaterial),
                ["collar"] = Assignment("pomegranate"),
                ["trim"] = Assignment("pomegranate"),
                ["belt"] = Assignment("pomegranate")
            }
        });
    }
}
