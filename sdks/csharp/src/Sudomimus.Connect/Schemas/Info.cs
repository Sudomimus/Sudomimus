using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record InfoRequest
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>IETF BCP 47 locale tag (e.g. <c>"en-US"</c>).</summary>
    [JsonPropertyName("locale")]
    public required string Locale { get; init; }
}

public sealed record InfoResponse
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>Localized application display name.</summary>
    [JsonPropertyName("applicationName")]
    public required string ApplicationName { get; init; }

    /// <summary>PEM-encoded application public key used to verify issued JWTs.</summary>
    [JsonPropertyName("applicationPublicKey")]
    public required string ApplicationPublicKey { get; init; }
}
