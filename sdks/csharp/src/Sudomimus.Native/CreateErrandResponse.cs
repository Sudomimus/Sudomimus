using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Response body for <c>POST /errand</c>.
/// </summary>
public sealed record CreateErrandResponse
{
    /// <summary>
    /// The browser side-trip to open, or <c>null</c> when the account already
    /// satisfies the application's claim policy.
    /// </summary>
    [JsonPropertyName("errand")]
    public ErrandHandoff? Errand { get; init; }

    /// <summary>
    /// Per-claim view explaining why each shareable claim is or is not present.
    /// </summary>
    [JsonPropertyName("claims")]
    public required ClaimsStateView Claims { get; init; }
}
