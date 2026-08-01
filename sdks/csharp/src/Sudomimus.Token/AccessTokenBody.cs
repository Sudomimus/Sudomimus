using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// The body (payload) claims carried in a Sudomimus access token.
/// </summary>
public sealed record AccessTokenBody
{
    [JsonPropertyName("iss")]
    public required string Issuer { get; init; }

    [JsonPropertyName("aud")]
    public required string Audience { get; init; }

    /// <summary>Pairwise, application-visible user key.</summary>
    [JsonPropertyName("sub")]
    public required string Subject { get; init; }

    [JsonPropertyName("sid")]
    public required string SessionId { get; init; }

    [JsonPropertyName("jti")]
    public required string JwtId { get; init; }

    [JsonPropertyName("iat")]
    public required long IssuedAt { get; init; }

    [JsonPropertyName("exp")]
    public required long ExpiresAt { get; init; }
}
