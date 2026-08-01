using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// The body (payload) claims carried in a Sudomimus refresh token.
/// </summary>
public sealed record RefreshTokenBody
{
    [JsonPropertyName("iss")]
    public required string Issuer { get; init; }

    [JsonPropertyName("aud")]
    public required string Audience { get; init; }

    [JsonPropertyName("sid")]
    public required string SessionId { get; init; }

    [JsonPropertyName("jti")]
    public required string JwtId { get; init; }

    [JsonPropertyName("iat")]
    public required long IssuedAt { get; init; }

    [JsonPropertyName("exp")]
    public required long ExpiresAt { get; init; }

    [JsonPropertyName("rotationVersion")]
    public required long RotationVersion { get; init; }
}
