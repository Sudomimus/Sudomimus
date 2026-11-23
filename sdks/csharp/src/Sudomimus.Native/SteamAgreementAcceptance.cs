using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>The exact revision and locale the Steam player explicitly confirmed.</summary>
public sealed record SteamAgreementAcceptance
{
    [JsonPropertyName("revision")]
    public required long Revision { get; init; }

    [JsonPropertyName("locale")]
    public required string Locale { get; init; }

    [JsonPropertyName("contentSha256")]
    public required string ContentSha256 { get; init; }

    [JsonPropertyName("confirmed")]
    public required bool Confirmed { get; init; }
}
