using System.Text.Json.Serialization;

namespace Sudomimus.Session;

/// <summary>
/// Error envelope returned by the Session API. <c>PRIVATE</c> reasons emit
/// an empty body — the property is then <c>null</c> and the HTTP status is
/// the only signal.
/// </summary>
public sealed record SessionErrorBody
{
    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}
