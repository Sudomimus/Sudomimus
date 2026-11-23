using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Policy and consent for UserInfo disclosure, as returned by direct issue
/// and claim-gate errors. Avatar animation is subordinate to avatar consent.
/// </summary>
public sealed record ClaimsStateView
{
    [JsonPropertyName("email")]
    public required ClaimRequirementStateView Email { get; init; }

    [JsonPropertyName("firstName")]
    public required ClaimRequirementStateView FirstName { get; init; }

    [JsonPropertyName("lastName")]
    public required ClaimRequirementStateView LastName { get; init; }

    [JsonPropertyName("avatar")]
    public required ClaimRequirementStateView Avatar { get; init; }

    [JsonPropertyName("avatarAnimation")]
    public required ClaimRequirementStateView AvatarAnimation { get; init; }
}
