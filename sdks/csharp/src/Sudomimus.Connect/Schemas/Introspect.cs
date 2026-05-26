using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record IntrospectRequest
{
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }
}

/// <summary>
/// Revocation states reported by <c>/introspect</c>. Values match the wire
/// format exactly (lowercase). <c>NotFound</c> covers an unknown session or
/// one belonging to a different application.
/// </summary>
public static class IntrospectStatus
{
    public const string Active = "active";
    public const string Revoked = "revoked";
    public const string Expired = "expired";
    public const string NotFound = "not_found";
}

public sealed record IntrospectResponse
{
    /// <summary>One of <see cref="IntrospectStatus"/>.</summary>
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("recommendedRecheckSeconds")]
    public required int RecommendedRecheckSeconds { get; init; }
}
