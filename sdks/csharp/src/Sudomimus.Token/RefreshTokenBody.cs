using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// The body (payload) claims carried in a Sudomimus refresh token.
/// </summary>
public sealed record RefreshTokenBody
{
    /// <summary>
    /// The application-visible sector subject (the same pairwise identifier
    /// as the access-token body). The refresh token leaves the system, so it
    /// must never carry the raw internal account identifier.
    /// </summary>
    [JsonPropertyName("subject")]
    public required string Subject { get; init; }
}
