using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using OcharoStudio.Application.Studio.State;
using WoW.Two.Sdk.Beta.Be.Identity.Core.Organizations;

namespace OcharoStudio.Api.Studio.Access;

/// <summary>Reads who a session is to Studio and routes it to its workspace.</summary>
public static class StudioAccess
{
    /// <summary>The permission writing a workspace's state needs.</summary>
    public const string EditPermission = "studio:edit";

    /// <summary>The member a session is, or null without an active organization or a role there: Studio serves any
    /// organization, and the workspace keeps each one's designs apart.</summary>
    public static StudioMember? MemberOf(ClaimsPrincipal user)
    {
        var subject = user.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrWhiteSpace(subject)
            || !Guid.TryParse(user.FindFirstValue(OrganizationClaimTypeConstants.Id), out var organization)
            || organization == Guid.Empty
            || user.GetOrganizationRole(organization) is null)
            return null;

        return new StudioMember(WorkspaceFor(organization, subject), subject, organization,
            user.HasOrganizationPermission(organization, EditPermission));
    }

    /// <summary>Separates each member's designs inside their authorized organization.</summary>
    public static Guid WorkspaceFor(Guid organizationId, string userId) => StudioWorkspace.IdFor(organizationId, userId);
}

/// <summary>A session's member of its active organization, with the workspace that holds their designs.</summary>
public sealed record StudioMember(Guid WorkspaceId, string UserId, Guid OrganizationId, bool CanEdit);
