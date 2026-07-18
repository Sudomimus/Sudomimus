using System.Text.Json.Serialization;

namespace Sudomimus.Session;

/// <summary>Health status values returned by the Session API.</summary>
public static class HealthStatus
{
    public const string Ok = "ok";
}

public sealed record HealthResponse
{
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("service")]
    public required string Service { get; init; }

    [JsonPropertyName("version")]
    public required string Version { get; init; }
}
