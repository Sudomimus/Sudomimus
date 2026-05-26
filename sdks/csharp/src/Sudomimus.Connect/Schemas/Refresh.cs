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
}
