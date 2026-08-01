using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// Exact JOSE protected-header fields shared by Sudomimus application access
/// and refresh tokens. Registered JWT claims live in the payload.
/// </summary>
public sealed record JwtHeader
{
    [JsonPropertyName("alg")]
    public required string Algorithm { get; init; }

    [JsonPropertyName("typ")]
    public required string Type { get; init; }

    [JsonPropertyName("kid")]
    public required string KeyId { get; init; }
}
