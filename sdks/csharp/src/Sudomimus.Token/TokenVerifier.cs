namespace Sudomimus.Token;

/// <summary>
/// Resolves an application's PEM-encoded RSA public key from its anchor.
/// Mirrors <c>@sudomimus/token</c>'s <c>PublicKeyResolver</c>.
/// </summary>
/// <param name="applicationAnchor">
/// The token's audience claim — typically the issuing application's anchor.
/// </param>
/// <param name="cancellationToken">Token observed for cooperative cancellation.</param>
public delegate Task<string> PublicKeyResolver(string applicationAnchor, CancellationToken cancellationToken);

/// <summary>
/// Verifies Sudomimus access and refresh tokens end-to-end: structural
/// integrity, expected key type, audience presence, expiration, and RSA
/// signature against a caller-supplied public key.
/// </summary>
public sealed class TokenVerifier
{
    private const string AccessKeyType = "Access";
    private const string RefreshKeyType = "Refresh";

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
        => VerifyAsync(jwt, AccessKeyType, TokenParser.ParseAccessToken, ct);

    /// <summary>
    /// Parse, verify, and return a Sudomimus refresh token.
    /// </summary>
    public Task<JwtToken<RefreshTokenBody>> VerifyRefreshTokenAsync(string jwt, CancellationToken ct = default)
        => VerifyAsync(jwt, RefreshKeyType, TokenParser.ParseRefreshToken, ct);

    private async Task<JwtToken<TBody>> VerifyAsync<TBody>(
        string jwt,
        string expectedKeyType,
        Func<string, JwtToken<TBody>> parser,
        CancellationToken ct)
        where TBody : class
    {
        // Peek header first so a wrong-type token surfaces as WrongKeyType
        // rather than InvalidJwt (which is what a body-shape mismatch would
        // otherwise produce — e.g. a refresh body has no firstName).
        var peeked = TokenParser.PeekHeader(jwt);
        if (!string.Equals(peeked.KeyType, expectedKeyType, StringComparison.Ordinal))
        {
            throw new TokenException(
                TokenErrorCode.WrongKeyType,
                $"Expected key type \"{expectedKeyType}\", got \"{peeked.KeyType ?? ""}\".");
        }

        var parsed = parser(jwt);
        var audience = parsed.Header.Audience;
        if (string.IsNullOrEmpty(audience))
        {
            throw new TokenException(
                TokenErrorCode.MissingAudience,
                "Token is missing the `aud` (applicationAnchor) header.");
        }

        if (!parsed.VerifyExpiration(_clock()))
        {
            throw new TokenException(TokenErrorCode.Expired, "Token has expired.");
        }

        var publicKey = await _resolver(audience, ct).ConfigureAwait(false);

        if (!parsed.VerifySignature(publicKey))
        {
            throw new TokenException(
                TokenErrorCode.InvalidSignature,
                "Token signature does not match the application public key.");
        }

        return parsed;
    }
}
