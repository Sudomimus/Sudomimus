using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>Pairwise Workload actor carried by a Workload access token.</summary>
public sealed record WorkloadActor
{
    [JsonPropertyName("sub")]
    public required string Subject { get; init; }
}

/// <summary>Access-token claims for an Agent or Automation Workload.</summary>
public sealed record WorkloadAccessTokenBody
{
    [JsonPropertyName("iss")] public required string Issuer { get; init; }
    [JsonPropertyName("aud")] public required string Audience { get; init; }
    /// <summary>Owner Account's pairwise sector subject.</summary>
    [JsonPropertyName("sub")] public required string Subject { get; init; }
    [JsonPropertyName("sid")] public required string SessionId { get; init; }
    [JsonPropertyName("jti")] public required string JwtId { get; init; }
    [JsonPropertyName("iat")] public required long IssuedAt { get; init; }
    [JsonPropertyName("exp")] public required long ExpiresAt { get; init; }
    [JsonPropertyName("act")] public required WorkloadActor Actor { get; init; }
}
