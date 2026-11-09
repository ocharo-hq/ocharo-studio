using System.Security.Cryptography;
using System.Text;

namespace OcharoStudio.Application.Studio.State;

/// <summary>Names a member's workspace and the Identity organization and account it belongs to.</summary>
/// <param name="Id">The workspace id, derived from the organization and the subject by <see cref="IdFor"/>.</param>
/// <param name="OrganizationId">The Identity organization the session names.</param>
/// <param name="UserId">The session's subject: an Identity account id.</param>
public sealed record StudioWorkspace(Guid Id, Guid OrganizationId, string UserId)
{
    /// <summary>The workspace of one member in one organization.</summary>
    public static StudioWorkspace For(Guid organizationId, string userId) => new(IdFor(organizationId, userId), organizationId, userId);

    /// <summary>Derives a member's workspace id: the first 16 bytes of a SHA-256 over the organization and the subject, so
    /// a row is found without a lookup and a browser-held id grants nothing.</summary>
    public static Guid IdFor(Guid organizationId, string userId) => new(
        SHA256.HashData(Encoding.UTF8.GetBytes($"ocharo-studio/v1\n{organizationId:D}\n{userId}")).AsSpan(0, 16));
}
