using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// Standard JWT envelope claims that <c>@sudoo/jwt</c> places in the header
/// segment. Sudomimus access and refresh tokens carry these claims here
/// rather than in the body.
/// </summary>
public sealed record JwtHeader
{
    [JsonPropertyName("alg")]
    public string? Algorithm { get; init; }

    [JsonPropertyName("typ")]
    public string? Type { get; init; }

    [JsonPropertyName("iss")]
    public string? Issuer { get; init; }

    [JsonPropertyName("aud")]
    public string? Audience { get; init; }

    [JsonPropertyName("iat")]
    public long? IssuedAt { get; init; }

    [JsonPropertyName("exp")]
    public long? ExpiresAt { get; init; }

    [JsonPropertyName("nbf")]
    public long? NotBefore { get; init; }

    [JsonPropertyName("jti")]
    public string? JwtId { get; init; }

    [JsonPropertyName("sub")]
    public string? Subject { get; init; }

    [JsonPropertyName("kty")]
    public string? KeyType { get; init; }

    [JsonPropertyName("ver")]
    public string? Version { get; init; }
}
