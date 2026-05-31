using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record RevokeAllRequest
{
    /// <summary>
    /// The sector subject the application sees for the user (the access /
    /// id token <c>sub</c>). Reverse-mapped server-side to the underlying
    /// account; a subject the application has never been issued (or one
    /// from another sector) revokes nothing. Sessions of the same account
    /// under other applications are unaffected.
    /// </summary>
    [JsonPropertyName("subject")]
    public required string Subject { get; init; }
}

public sealed record RevokeAllResponse
{
    [JsonPropertyName("revokedCount")]
    public required int RevokedCount { get; init; }
}
