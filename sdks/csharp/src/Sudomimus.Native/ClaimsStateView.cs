using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Per-claim view across the four shareable claims, carried on every
/// direct-issue 200 (why a claim is or is not in the minted token) and on the
/// claim-gate 403 (what is still owed).
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
}
