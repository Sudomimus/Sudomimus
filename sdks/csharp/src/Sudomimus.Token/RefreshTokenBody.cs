using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// The body (payload) claims carried in a Sudomimus refresh token.
/// </summary>
public sealed record RefreshTokenBody
{
    [JsonPropertyName("accountIdentifier")]
    public required string AccountIdentifier { get; init; }
}
