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
    /// <summary>
    /// The application-visible user identifier — the per-(account, sector)
    /// "sector subject", also the OIDC <c>sub</c>. The raw internal account
    /// identifier never appears in a token. Opaque: never parse it.
    /// </summary>
    [JsonPropertyName("subject")]
    public required string Subject { get; init; }

    /// <summary>
    /// Given name. Consent-gated (claim sharing): minted only when the
    /// application's claim policy permits it AND the user has granted the
    /// claim, so it may be absent even when the account has a value stored.
    /// </summary>
    [JsonPropertyName("firstName")]
    public string? FirstName { get; init; }

    /// <summary>Family name. Same consent gating as <c>FirstName</c>.</summary>
    [JsonPropertyName("lastName")]
    public string? LastName { get; init; }

    /// <summary>
    /// Verified email associated with this login. Consent-gated like
    /// <c>FirstName</c> / <c>LastName</c> / avatar URLs (minted only when
    /// policy permits AND the user granted the EMAIL claim), and omitted for
    /// accounts with no verified email unless a synthetic email policy emits a
    /// proxy address.
    /// </summary>
    [JsonPropertyName("emailAddress")]
    public string? EmailAddress { get; init; }

    /// <summary>
    /// Sector-scoped static public avatar URL. Consent-gated like the other
    /// shareable claims; synthetic avatar policies may emit a generated
    /// placeholder image.
    /// </summary>
    [JsonPropertyName("staticAvatarUrl")]
    public string? StaticAvatarUrl { get; init; }

    /// <summary>
    /// Sector-scoped animated public avatar URL. Consent-gated separately from
    /// <c>StaticAvatarUrl</c>. If the selected avatar has no animation, this is
    /// the same URL as <c>StaticAvatarUrl</c>.
    /// </summary>
    [JsonPropertyName("animatedAvatarUrl")]
    public string? AnimatedAvatarUrl { get; init; }
}
