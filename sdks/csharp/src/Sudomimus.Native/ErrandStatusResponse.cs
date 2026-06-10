using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>Response body for <c>GET /errand/{errandKey}/status</c>.</summary>
public sealed record ErrandStatusResponse
{
    /// <summary>One of <see cref="ErrandStatus"/>.</summary>
    [JsonPropertyName("status")]
    public required string Status { get; init; }
}
