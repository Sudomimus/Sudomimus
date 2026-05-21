using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// The body (payload) claims carried in a Sudomimus access token.
/// </summary>
/// <remarks>
/// Mirrors <c>@sudomimus/token</c>'s <c>AccessTokenBody</c>. Standard JWT
/// envelope claims (<c>iss</c>, <c>aud</c>, <c>iat</c>, <c>exp</c>,
/// <c>jti</c>, <c>kty</c>, <c>sub</c>) live in the header, not here.
/// </remarks>
public sealed record AccessTokenBody
{
    [JsonPropertyName("accountIdentifier")]
    public required string AccountIdentifier { get; init; }

    [JsonPropertyName("firstName")]
    public required string FirstName { get; init; }

    [JsonPropertyName("lastName")]
    public string? LastName { get; init; }
}
