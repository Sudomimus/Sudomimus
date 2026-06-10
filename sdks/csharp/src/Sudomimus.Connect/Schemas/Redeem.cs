using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record RedeemRequest
{
    [JsonPropertyName("exposureKey")]
    public required string ExposureKey { get; init; }

    [JsonPropertyName("hiddenKey")]
    public required string HiddenKey { get; init; }

    [JsonPropertyName("confirmationKey")]
    public required string ConfirmationKey { get; init; }
}

public sealed record RedeemResponse
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    [JsonPropertyName("refreshToken")]
    public required string RefreshToken { get; init; }

    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }

    /// <summary>
    /// Per-claim view explaining why each shareable claim is or is not present
    /// in the minted token (the application's policy joined with the user's
    /// standing decision).
    /// </summary>
    [JsonPropertyName("claims")]
    public required ClaimsStateView Claims { get; init; }
}
