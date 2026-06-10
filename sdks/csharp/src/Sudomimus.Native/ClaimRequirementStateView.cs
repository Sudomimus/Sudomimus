using System.Text.Json.Serialization;

namespace Sudomimus.Native;

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
