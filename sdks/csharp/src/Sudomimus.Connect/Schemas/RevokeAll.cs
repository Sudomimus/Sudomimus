using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record RevokeAllRequest
{
    /// <summary>
    /// Identifier of the account whose sessions should be revoked for the
    /// calling application. Sessions of the same account under other
    /// applications are unaffected.
    /// </summary>
    [JsonPropertyName("accountIdentifier")]
    public required string AccountIdentifier { get; init; }
}

public sealed record RevokeAllResponse
{
    [JsonPropertyName("revokedCount")]
    public required int RevokedCount { get; init; }
}
