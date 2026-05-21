using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Response body for <c>POST /direct-issue/steam-ticket</c>.
/// </summary>
public sealed record DirectIssueSteamTicketResponse
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>Short-lived application access token (JWT).</summary>
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }

    /// <summary>Long-lived application refresh token (JWT).</summary>
    [JsonPropertyName("refreshToken")]
    public required string RefreshToken { get; init; }
}
