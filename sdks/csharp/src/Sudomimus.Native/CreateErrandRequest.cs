using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Request body for <c>POST /errand</c>.
/// </summary>
public sealed record CreateErrandRequest
{
    /// <summary>
    /// An access token (JWT) the application already holds for the user.
    /// Verified server-side with its expiry enforced.
    /// </summary>
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }
}
