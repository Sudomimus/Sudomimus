using System.Text;
using System.Text.Json;

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
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>Parse a Sudomimus access token (header + <see cref="AccessTokenBody"/>).</summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid or claims fail to deserialize.</exception>
    public static JwtToken<AccessTokenBody> ParseAccessToken(string jwt) => Parse<AccessTokenBody>(jwt);

    /// <summary>Parse a Sudomimus refresh token (header + <see cref="RefreshTokenBody"/>).</summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid or claims fail to deserialize.</exception>
    public static JwtToken<RefreshTokenBody> ParseRefreshToken(string jwt) => Parse<RefreshTokenBody>(jwt);

    /// <summary>
    /// Decode and return only the header segment. Useful for inspecting the
    /// key type or audience before committing to a full typed parse — e.g.
    /// the verifier checks <c>kty</c> first so wrong-type tokens give a
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

    private static JwtToken<TBody> Parse<TBody>(string jwt)
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

        var signingInput = Encoding.UTF8.GetBytes($"{headerSegment}.{bodySegment}");
        return new JwtToken<TBody>(jwt, signingInput, signatureBytes, header, body);
    }
}
