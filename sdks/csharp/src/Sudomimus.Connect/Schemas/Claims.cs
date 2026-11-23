using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>
/// The application's policy for a shareable claim, set by the developer.
/// Values match the wire format exactly. One of these appears on
/// <see cref="ClaimRequirementStateView.Requirement"/>.
/// </summary>
public static class ClaimRequirement
{
    /// <summary>The application never requests this claim; it is never minted.</summary>
    public const string Off = "OFF";

    /// <summary>Minted only when the user has granted it; never blocks issue.</summary>
    public const string Optional = "OPTIONAL";

    /// <summary>The user must grant it for a non-interactive issue to succeed.</summary>
    public const string Required = "REQUIRED";

    /// <summary>Always emits a generated placeholder and never asks for real data.</summary>
    public const string SyntheticOnly = "SYNTHETIC_ONLY";

    /// <summary>Emits real data when shared, otherwise a generated placeholder.</summary>
    public const string SyntheticFallback = "SYNTHETIC_FALLBACK";
}

/// <summary>
/// The user's standing decision for a shareable claim. Values match the wire
/// format exactly. One of these appears on
/// <see cref="ClaimRequirementStateView.State"/>.
/// </summary>
public static class ClaimGrantState
{
    /// <summary>The user has never been asked.</summary>
    public const string Unknown = "UNKNOWN";

    /// <summary>The user agreed; the claim is included when the policy allows.</summary>
    public const string Granted = "GRANTED";

    /// <summary>The user explicitly declined; the claim is withheld and not re-asked.</summary>
    public const string Denied = "DENIED";
}

/// <summary>
/// One shareable claim's wire view: what the application requests
/// (<see cref="Requirement"/>) joined with the user's standing decision
/// (<see cref="State"/>). The pair distinguishes "never asked"
/// (<see cref="ClaimGrantState.Unknown"/>) from "explicitly declined"
/// (<see cref="ClaimGrantState.Denied"/>) from "granted".
/// </summary>
public sealed record ClaimRequirementStateView
{
    /// <summary>One of <see cref="ClaimRequirement"/>.</summary>
    [JsonPropertyName("requirement")]
    public required string Requirement { get; init; }

    /// <summary>One of <see cref="ClaimGrantState"/>.</summary>
    [JsonPropertyName("state")]
    public required string State { get; init; }
}

/// <summary>
/// Policy and consent for UserInfo disclosure, as returned by <c>/redeem</c>.
/// Avatar animation is subordinate to avatar consent. Read profile values from UserInfo.
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
