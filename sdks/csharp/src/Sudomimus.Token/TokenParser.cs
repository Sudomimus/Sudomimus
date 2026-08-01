using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>
/// Parses Sudomimus JWTs without verifying signatures. Use this when you
/// only need to read claims — e.g. peeking the audience to find a public
/// key. For trust decisions use <see cref="TokenVerifier"/>.
/// </summary>
public static class TokenParser
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    /// <summary>Parse a Sudomimus access token (header + <see cref="AccessTokenBody"/>).</summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid or claims fail to deserialize.</exception>
    public static JwtToken<AccessTokenBody> ParseAccessToken(string jwt) =>
        Parse<AccessTokenBody>(jwt, TokenVerifier.AccessTokenType, ValidateAccessTokenBody);

    /// <summary>Parse a Sudomimus refresh token (header + <see cref="RefreshTokenBody"/>).</summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid or claims fail to deserialize.</exception>
    public static JwtToken<RefreshTokenBody> ParseRefreshToken(string jwt) =>
        Parse<RefreshTokenBody>(jwt, TokenVerifier.RefreshTokenType, ValidateRefreshTokenBody);

    /// <summary>
    /// Decode and return only the header segment. Useful for inspecting the
    /// token media type before committing to a full typed parse — e.g.
    /// the verifier checks <c>typ</c> first so wrong-type tokens give a
    /// clearer error than "body deserialization failed".
    /// </summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid.</exception>
    public static JwtHeader PeekHeader(string jwt)
    {
        if (string.IsNullOrEmpty(jwt))
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "Token is empty.");
        }

        var parts = jwt.Split('.');
        if (parts.Length != 3)
        {
            throw new TokenException(
                TokenErrorCode.InvalidJwt,
                $"Token must have exactly three dot-separated segments; got {parts.Length}.");
        }

        byte[] headerBytes;
        try
        {
            headerBytes = JwtCodec.DecodeBase64UrlSegment(parts[0]);
        }
        catch (FormatException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to decode JWT header segment: {ex.Message}");
        }

        try
        {
            var header = JsonSerializer.Deserialize<JwtHeader>(headerBytes, s_jsonOptions);
            if (header is null)
            {
                throw new TokenException(TokenErrorCode.InvalidJwt, "JWT header deserialized to null.");
            }
            return header;
        }
        catch (JsonException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to deserialize JWT header: {ex.Message}");
        }
    }

    internal static JsonElement PeekBody(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length != 3)
        {
            throw new TokenException(
                TokenErrorCode.InvalidJwt,
                $"Token must have exactly three dot-separated segments; got {parts.Length}.");
        }

        try
        {
            var bodyBytes = JwtCodec.DecodeBase64UrlSegment(parts[1]);
            using var document = JsonDocument.Parse(bodyBytes);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new TokenException(TokenErrorCode.InvalidJwt, "JWT body must be a JSON object.");
            }
            return document.RootElement.Clone();
        }
        catch (JsonException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to deserialize JWT body: {ex.Message}");
        }
        catch (FormatException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to decode JWT body: {ex.Message}");
        }
    }

    private static JwtToken<TBody> Parse<TBody>(
        string jwt,
        string expectedTokenType,
        Action<TBody> validateBody)
        where TBody : class
    {
        if (string.IsNullOrEmpty(jwt))
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "Token is empty.");
        }

        var parts = jwt.Split('.');
        if (parts.Length != 3)
        {
            throw new TokenException(
                TokenErrorCode.InvalidJwt,
                $"Token must have exactly three dot-separated segments; got {parts.Length}.");
        }

        var headerSegment = parts[0];
        var bodySegment = parts[1];
        var signatureSegment = parts[2];

        byte[] headerBytes;
        byte[] bodyBytes;
        byte[] signatureBytes;

        try
        {
            headerBytes = JwtCodec.DecodeBase64UrlSegment(headerSegment);
            bodyBytes = JwtCodec.DecodeBase64UrlSegment(bodySegment);
            signatureBytes = JwtCodec.DecodeBase64UrlSegment(signatureSegment);
        }
        catch (FormatException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to decode JWT segments: {ex.Message}");
        }

        JwtHeader? header;
        TBody? body;

        try
        {
            header = JsonSerializer.Deserialize<JwtHeader>(headerBytes, s_jsonOptions);
            body = JsonSerializer.Deserialize<TBody>(bodyBytes, s_jsonOptions);
        }
        catch (JsonException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to deserialize JWT claims: {ex.Message}");
        }

        if (header is null || body is null)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "JWT header or body deserialized to null.");
        }

        ValidateHeader(header, expectedTokenType);
        validateBody(body);

        var signingInput = Encoding.UTF8.GetBytes($"{headerSegment}.{bodySegment}");
        return new JwtToken<TBody>(jwt, signingInput, signatureBytes, header, body);
    }

    private static void ValidateHeader(JwtHeader header, string expectedTokenType)
    {
        if (!string.Equals(header.Algorithm, "RS256", StringComparison.Ordinal)
            || !string.Equals(header.Type, expectedTokenType, StringComparison.Ordinal)
            || string.IsNullOrEmpty(header.KeyId))
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "JWT protected header does not match the 4.0.0 contract.");
        }
    }

    private static void ValidateAccessTokenBody(AccessTokenBody body)
    {
        if (!IsAbsoluteUri(body.Issuer)
            || string.IsNullOrEmpty(body.Audience)
            || string.IsNullOrEmpty(body.Subject)
            || string.IsNullOrEmpty(body.SessionId)
            || string.IsNullOrEmpty(body.JwtId)
            || body.IssuedAt < 0
            || body.ExpiresAt < 1)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "Access-token payload does not match the 4.0.0 contract.");
        }
    }

    private static void ValidateRefreshTokenBody(RefreshTokenBody body)
    {
        if (!IsAbsoluteUri(body.Issuer)
            || string.IsNullOrEmpty(body.Audience)
            || string.IsNullOrEmpty(body.SessionId)
            || string.IsNullOrEmpty(body.JwtId)
            || body.IssuedAt < 0
            || body.ExpiresAt < 1
            || body.RotationVersion < 1)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "Refresh-token payload does not match the 4.0.0 contract.");
        }
    }

    private static bool IsAbsoluteUri(string value) =>
        !string.IsNullOrEmpty(value) && Uri.TryCreate(value, UriKind.Absolute, out _);
}
