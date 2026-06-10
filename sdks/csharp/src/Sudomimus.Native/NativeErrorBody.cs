using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Error envelope returned by the Native API when a request fails with a
/// known reason. Empty bodies (<c>PRIVATE</c> reasons) are surfaced as
/// <c>null</c> on <see cref="NativeApiException.Body"/>.
/// </summary>
public sealed record NativeErrorBody
{
    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    /// <summary>
    /// Present only on the claim-gate 403s
    /// (<see cref="NativeReason.ClaimConsentRequired"/> /
    /// <see cref="NativeReason.RequiredClaimDataMissing"/>): the per-claim view
    /// of what the application requests and what the user has decided.
    /// </summary>
    [JsonPropertyName("claims")]
    public ClaimsStateView? Claims { get; init; }

    /// <summary>
    /// Present only on the claim-gate 403s: the browser handoff that lets the
    /// user grant consent / complete missing data so a retry can succeed.
    /// </summary>
    [JsonPropertyName("errand")]
    public ErrandHandoff? Errand { get; init; }
}
