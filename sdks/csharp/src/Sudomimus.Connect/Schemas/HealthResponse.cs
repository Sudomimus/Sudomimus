using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record HealthResponse
{
    [JsonPropertyName("ready")]
    public required bool Ready { get; init; }

    [JsonPropertyName("service")]
    public required string Service { get; init; }

    [JsonPropertyName("version")]
    public required string Version { get; init; }
}
