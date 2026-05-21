using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Error envelope returned by the Native API when a request fails with a
/// known reason. Empty bodies (<c>PRIVATE</c> reasons) are surfaced as
/// <c>null</c> on <see cref="NativeApiException.Body"/>.
/// </summary>
public sealed record NativeErrorBody
{
    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}
