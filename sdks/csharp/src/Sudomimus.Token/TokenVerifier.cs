namespace Sudomimus.Token;

/// <summary>
/// Resolves an application's PEM-encoded RSA public key from its anchor.
/// Mirrors <c>@sudomimus/token</c>'s <c>PublicKeyResolver</c>.
/// </summary>
/// <param name="applicationAnchor">
/// The token's audience claim — typically the issuing application's anchor.
/// </param>
/// <param name="keyId">The JWT JOSE header <c>kid</c> used to select a JWK.</param>
/// <param name="cancellationToken">Token observed for cooperative cancellation.</param>
public delegate Task<string> PublicKeyResolver(
    string applicationAnchor,
    string keyId,
    CancellationToken cancellationToken);

/// <summary>
/// Verifies Sudomimus access and refresh tokens end-to-end: structural
/// integrity, expected token media type, audience presence, expiration, and RSA
/// signature against a caller-supplied public key.
/// </summary>
public sealed class TokenVerifier
{
    public const string AccessTokenType = "vnd.sudomimus.application-access+jwt";
    public const string RefreshTokenType = "vnd.sudomimus.application-refresh+jwt";

    private readonly PublicKeyResolver _resolver;
    private readonly Func<DateTimeOffset> _clock;

    public TokenVerifier(PublicKeyResolver resolver)
        : this(resolver, () => DateTimeOffset.UtcNow)
    {
    }

    /// <param name="resolver">Resolver for the application's PEM public key.</param>
    /// <param name="clock">Override "now" for tests. Defaults to <c>DateTimeOffset.UtcNow</c>.</param>
    public TokenVerifier(PublicKeyResolver resolver, Func<DateTimeOffset> clock)
    {
        _resolver = resolver;
        _clock = clock;
    }

    /// <summary>
    /// Parse, verify, and return a Sudomimus access token. Throws
    /// <see cref="TokenException"/> with a categorized code on any failure.
    /// </summary>
    public Task<JwtToken<AccessTokenBody>> VerifyAccessTokenAsync(string jwt, CancellationToken ct = default)
        => VerifyAsync(jwt, AccessTokenType, TokenParser.ParseAccessToken, ct);

    /// <summary>
    /// Parse, verify, and return a Sudomimus refresh token.
    /// </summary>
    public Task<JwtToken<RefreshTokenBody>> VerifyRefreshTokenAsync(string jwt, CancellationToken ct = default)
        => VerifyAsync(jwt, RefreshTokenType, TokenParser.ParseRefreshToken, ct);

    private async Task<JwtToken<TBody>> VerifyAsync<TBody>(
        string jwt,
        string expectedTokenType,
        Func<string, JwtToken<TBody>> parser,
        CancellationToken ct)
        where TBody : class
    {
        // Peek first so a wrong-type token surfaces as WrongTokenType rather
        // than InvalidJwt from the expected payload shape.
        var peeked = TokenParser.PeekHeader(jwt);
        if (!string.Equals(peeked.Type, expectedTokenType, StringComparison.Ordinal))
        {
            throw new TokenException(
                TokenErrorCode.WrongTokenType,
                $"Expected token type \"{expectedTokenType}\", got \"{peeked.Type}\".");
        }

        var payload = TokenParser.PeekBody(jwt);
        var audience = payload.TryGetProperty("aud", out var audienceElement)
            && audienceElement.ValueKind == System.Text.Json.JsonValueKind.String
            ? audienceElement.GetString()
            : null;
        if (string.IsNullOrEmpty(audience))
        {
            throw new TokenException(
                TokenErrorCode.MissingAudience,
                "Token is missing the `aud` (applicationAnchor) payload claim.");
        }

        var keyId = peeked.KeyId;
        if (string.IsNullOrEmpty(keyId))
        {
            throw new TokenException(
                TokenErrorCode.MissingKeyId,
                "Token is missing the `kid` signing-key identifier.");
        }

        var parsed = parser(jwt);

        if (!parsed.VerifyExpiration(_clock()))
        {
            throw new TokenException(TokenErrorCode.Expired, "Token has expired.");
        }

        var publicKey = await _resolver(audience, keyId, ct).ConfigureAwait(false);

        if (!parsed.VerifySignature(publicKey))
        {
            throw new TokenException(
                TokenErrorCode.InvalidSignature,
                "Token signature does not match the application public key.");
        }

        return parsed;
    }
}
