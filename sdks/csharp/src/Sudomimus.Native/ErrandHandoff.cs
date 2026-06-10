using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// The browser side-trip a claim-gate 403 hands back. Open <see cref="Url"/> in
/// the user's system browser; the user authenticates (when account data is
/// written), completes any missing data, and grants consent. Poll
/// <see cref="ErrandKey"/> via <see cref="NativeClient.GetErrandStatusAsync"/>
/// (or wait for the user), then retry the original direct-issue request once.
/// </summary>
public sealed record ErrandHandoff
{
    /// <summary>Bearer key (<c>ernd_…</c>); also the status-poll path key.</summary>
    [JsonPropertyName("errandKey")]
    public required string ErrandKey { get; init; }

    /// <summary>Open this in the user's system browser.</summary>
    [JsonPropertyName("url")]
    public required string Url { get; init; }

    /// <summary>When the handoff expires (~30 minutes from mint).</summary>
    [JsonPropertyName("expiresAt")]
    public required DateTimeOffset ExpiresAt { get; init; }
}
