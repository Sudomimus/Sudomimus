using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>
/// Error envelope returned by the Connect API. <c>PRIVATE</c> reasons emit
/// an empty body — the property is then <c>null</c> and the HTTP status is
/// the only signal.
/// </summary>
public sealed record ConnectErrorBody
{
    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}
