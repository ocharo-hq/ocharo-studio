using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Foundation.Errors;
using WoW.Two.Sdk.Beta.Be.Foundation.Validation;

namespace OcharoStudio.Application.Studio.Errors;

/// <summary>Holds the error catalogue of Studio's state and thumbnail use cases.</summary>
public static class StudioErrors
{
    /// <summary>The field a state that fails validation reports its failures under.</summary>
    public const string StateField = "state";

    /// <summary>The field a thumbnail link the workspace does not hold reports under.</summary>
    public const string ThumbnailField = "thumbnail";

    /// <summary>The field a save without material metadata reports under.</summary>
    public const string MaterialsField = "materials";

    /// <summary>Creates the error for a state that fails validation, one field failure per message.</summary>
    /// <param name="messages">The validation messages, at least one.</param>
    public static AppError StateInvalid(IReadOnlyList<string> messages) =>
        ValidationError.From([.. messages.Select(message => Field(StateField, message, nameof(StateInvalid)))]);

    /// <summary>Creates the error for a thumbnail link that names a file the workspace does not hold.</summary>
    public static AppError ThumbnailUnknown() =>
        ValidationError.From([Field(ThumbnailField, "A thumbnail link names a file this workspace does not hold.", nameof(ThumbnailUnknown))]);

    /// <summary>Creates the error for a save that drops the material metadata the stored state holds.</summary>
    public static AppError MaterialsRequired() =>
        ValidationError.From([Field(MaterialsField, "Material metadata is required. Reload or upgrade the studio before saving.", nameof(MaterialsRequired))]);

    /// <summary>Creates the error for a save whose revision is no longer the stored one.</summary>
    public static AppError RevisionConflict() => AppErrorFactory.Conflict("Revision conflict");

    /// <summary>Creates the error for a thumbnail the member's workspace does not hold, or one gone from WoW2 Files.</summary>
    public static AppError ThumbnailNotFound() => AppErrorFactory.NotFound("The thumbnail was not found.");

    /// <summary>Creates the error for a WoW2 Files call that failed, by the kind the thumbnail store gave it: a refused
    /// input, a file gone, Files unavailable, else Files refusing for a reason Studio cannot name (502).</summary>
    /// <param name="refusal">The failure the thumbnail store raised.</param>
    public static AppError FilesFailed(StudioFilesException refusal) => refusal.Status switch
    {
        400 => AppErrorFactory.Validation(refusal.Message),
        404 => AppErrorFactory.NotFound(refusal.Message),
        503 => AppErrorFactory.ExternalUnavailable(refusal.Message),
        _ => AppErrorFactory.ExternalRejected(refusal.Message),
    };

    private static FieldError Field(string property, string message, string code) =>
        new() { Property = property, Message = message, Code = code };
}
