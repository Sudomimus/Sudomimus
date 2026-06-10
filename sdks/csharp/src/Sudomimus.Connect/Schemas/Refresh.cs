using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record RefreshRequest
{
    [JsonPropertyName("refreshToken")]
    public required string RefreshToken { get; init; }
}

public sealed record RefreshResponse
{
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }

    /// <summary>
    /// Newly issued refresh token (JWT). The presented refresh token is
    /// invalidated atomically as part of the same call; re-presenting it
    /// is treated as compromise under OAuth 2.1 BCP §4.14.2 strict
    /// rotation and the entire refresh-token family is revoked.
    /// </summary>
    [JsonPropertyName("refreshToken")]
    public required string RefreshToken { get; init; }

    /// <summary>
    /// Per-claim view explaining why each shareable claim is or is not present
    /// in the minted token. Read it after a refresh to detect a policy
    /// escalation (a claim that became REQUIRED but is not yet satisfied).
    /// </summary>
    [JsonPropertyName("claims")]
    public required ClaimsStateView Claims { get; init; }
}
