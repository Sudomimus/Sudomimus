using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sudomimus.Token;

/// <summary>Header claims of an OIDC <c>id_token</c>.</summary>
/// <remarks>
/// Unlike Sudomimus access/refresh tokens, an id_token is a standard OIDC JWT:
/// <c>kid</c> identifies the platform signing key in the OIDC JWKS.
/// </remarks>
public sealed record IdTokenHeader
{
    [JsonPropertyName("alg")] public string? Algorithm { get; init; }
    [JsonPropertyName("typ")] public string? Type { get; init; }
    [JsonPropertyName("kid")] public string? KeyId { get; init; }
}

/// <summary>Body claims of a Sudomimus OIDC <c>id_token</c>.</summary>
/// <remarks>
/// Every claim lives in the JWT body (standard OIDC). <c>Subject</c> is the
/// per-(account, sector) sector subject — identical to the access-token body
/// <c>Subject</c>. The token is signed by the platform key.
/// </remarks>
public sealed record IdTokenBody
{
    [JsonPropertyName("iss")] public required string Issuer { get; init; }
    [JsonPropertyName("sub")] public required string Subject { get; init; }
    [JsonPropertyName("aud")] public required string Audience { get; init; }
    [JsonPropertyName("iat")] public required long IssuedAt { get; init; }
    [JsonPropertyName("exp")] public required long ExpiresAt { get; init; }
    [JsonPropertyName("at_hash")] public string? AtHash { get; init; }
    [JsonPropertyName("nonce")] public string? Nonce { get; init; }
    [JsonPropertyName("auth_time")] public long? AuthTime { get; init; }
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("email_verified")] public bool? EmailVerified { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("amr")] public IReadOnlyList<string>? Amr { get; init; }
    [JsonPropertyName("acr")] public string? Acr { get; init; }
}

/// <summary>Decoded response of the OIDC <c>/userinfo</c> endpoint.</summary>
public sealed record UserInfoResponse
{
    [JsonPropertyName("sub")] public required string Subject { get; init; }
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("email_verified")] public bool? EmailVerified { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
}

/// <summary>
/// Optional expectations narrowing <see cref="IdToken.Verify"/>. A <c>null</c>
/// field is not checked; a <c>null</c> <see cref="Now"/> defaults to
/// <see cref="DateTimeOffset.UtcNow"/>.
/// </summary>
public sealed record IdTokenExpectations
{
    public string? Audience { get; init; }
    public string? Issuer { get; init; }
    public string? Nonce { get; init; }
    public DateTimeOffset? Now { get; init; }
}

/// <summary>
/// A parsed Sudomimus OIDC <c>id_token</c>. Unlike Sudomimus access/refresh
/// tokens (whose envelope claims live in the JWT header), an id_token is a
/// standard OIDC JWT: every claim lives in the body and the token is signed by
/// the <b>platform</b> key (resolve it from the OIDC JWKS by the header
/// <c>kid</c>), not by an application's signing key. <see cref="Verify"/>
/// therefore checks <c>exp</c> from the body.
/// </summary>
public sealed class IdToken
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public string Raw { get; }
    public byte[] SigningInput { get; }
    public byte[] Signature { get; }
    public IdTokenHeader Header { get; }
    public IdTokenBody Body { get; }

    private IdToken(string raw, byte[] signingInput, byte[] signature, IdTokenHeader header, IdTokenBody body)
    {
        Raw = raw;
        SigningInput = signingInput;
        Signature = signature;
        Header = header;
        Body = body;
    }

    /// <summary>Verify the signature with the given PEM-encoded platform RSA public key.</summary>
    public bool VerifySignature(string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        return rsa.VerifyData(
            SigningInput,
            Signature,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
    }

    /// <summary>Parse an id_token into its header and body without verifying it.</summary>
    /// <exception cref="TokenException">Thrown when the JWT is structurally invalid.</exception>
    public static IdToken Parse(string jwt)
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
        byte[] bodyBytes;
        byte[] signatureBytes;
        try
        {
            headerBytes = JwtCodec.DecodeBase64UrlSegment(parts[0]);
            bodyBytes = JwtCodec.DecodeBase64UrlSegment(parts[1]);
            signatureBytes = JwtCodec.DecodeBase64UrlSegment(parts[2]);
        }
        catch (FormatException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to decode id_token segments: {ex.Message}");
        }

        IdTokenHeader? header;
        IdTokenBody? body;
        try
        {
            header = JsonSerializer.Deserialize<IdTokenHeader>(headerBytes, s_jsonOptions);
            body = JsonSerializer.Deserialize<IdTokenBody>(bodyBytes, s_jsonOptions);
        }
        catch (JsonException ex)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, $"Failed to deserialize id_token claims: {ex.Message}");
        }

        if (header is null || body is null)
        {
            throw new TokenException(TokenErrorCode.InvalidJwt, "id_token header or body deserialized to null.");
        }

        var signingInput = Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}");
        return new IdToken(jwt, signingInput, signatureBytes, header, body);
    }

    /// <summary>
    /// Verify an OIDC id_token against a platform public key (resolved from the
    /// OIDC JWKS). Checks the body <c>exp</c>, the RS256 signature, and any of
    /// the supplied audience/issuer/nonce expectations.
    /// </summary>
    /// <exception cref="TokenException">Thrown on any verification failure.</exception>
    public static IdToken Verify(string jwt, string platformPublicKeyPem, IdTokenExpectations? expectations = null)
    {
        var parsed = Parse(jwt);
        var expect = expectations ?? new IdTokenExpectations();
        var now = expect.Now ?? DateTimeOffset.UtcNow;

        if (now >= DateTimeOffset.FromUnixTimeSeconds(parsed.Body.ExpiresAt))
        {
            throw new TokenException(TokenErrorCode.Expired, "id_token has expired.");
        }

        if (!parsed.VerifySignature(platformPublicKeyPem))
        {
            throw new TokenException(
                TokenErrorCode.InvalidSignature,
                "id_token signature does not match the platform public key.");
        }

        if (expect.Audience is not null && parsed.Body.Audience != expect.Audience)
        {
            throw new TokenException(TokenErrorCode.WrongAudience, "id_token aud does not match the expected client id.");
        }
        if (expect.Issuer is not null && parsed.Body.Issuer != expect.Issuer)
        {
            throw new TokenException(TokenErrorCode.WrongIssuer, "id_token iss does not match the expected issuer.");
        }
        if (expect.Nonce is not null && parsed.Body.Nonce != expect.Nonce)
        {
            throw new TokenException(TokenErrorCode.WrongNonce, "id_token nonce does not match the value sent at /authorize.");
        }

        return parsed;
    }
}
