using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record LogoutRequest
{
    [JsonPropertyName("refreshToken")]
    public required string RefreshToken { get; init; }
}

public sealed record LogoutResponse
{
    /// <summary>
    /// True if the session is now revoked — also true for sessions that were
    /// already revoked or expired (idempotent). False signals that the token
    /// could not be resolved (without revealing whether it ever existed).
    /// </summary>
    [JsonPropertyName("revoked")]
    public required bool Revoked { get; init; }
}
