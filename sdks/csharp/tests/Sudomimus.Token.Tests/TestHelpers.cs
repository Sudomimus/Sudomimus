using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sudomimus.Token;

namespace Sudomimus.Token.Tests;

/// <summary>
/// Mints compact RS256 fixtures matching the 4.0.0 token contract.
/// </summary>
internal static class TestHelpers
{
    public sealed record RsaKeyPair(string PublicKeyPem, string PrivateKeyPem);

    public static RsaKeyPair GenerateRsaKeyPair(int keySize = 2048)
    {
        using var rsa = RSA.Create(keySize);
        var publicPem = rsa.ExportSubjectPublicKeyInfoPem();
        var privatePem = rsa.ExportPkcs8PrivateKeyPem();
        return new RsaKeyPair(publicPem, privatePem);
    }

    public static string MintToken<THeader, TBody>(THeader header, TBody body, string privateKeyPem)
    {
        // @sudoo/jwt 3.6+ emits all three JWT segments as base64url, no padding.
        var headerSeg = ToBase64Url(JsonSerializer.SerializeToUtf8Bytes(header));
        var bodySeg = ToBase64Url(JsonSerializer.SerializeToUtf8Bytes(body));

        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        var signingInput = Encoding.UTF8.GetBytes($"{headerSeg}.{bodySeg}");
        var signature = rsa.SignData(signingInput, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var sigSeg = ToBase64Url(signature);

        return $"{headerSeg}.{bodySeg}.{sigSeg}";
    }

    private static string ToBase64Url(byte[] bytes)
    {
        return StripPadding(Convert.ToBase64String(bytes)).Replace('+', '-').Replace('/', '_');
    }

    /// <summary>base64url-encode a raw (already-serialized) segment string.</summary>
    public static string EncodeSegment(string raw) => ToBase64Url(Encoding.UTF8.GetBytes(raw));

    /// <summary>
    /// Build a structurally valid (3-segment) JWT from raw, pre-base64url
    /// header/body/signature payloads. The signature is not real — useful for
    /// exercising parse paths that run before signature verification.
    /// </summary>
    public static string MintRaw(string headerJson, string bodyJson, string signature = "sig")
        => $"{EncodeSegment(headerJson)}.{EncodeSegment(bodyJson)}.{EncodeSegment(signature)}";

    public static string MintAccessToken(string privateKeyPem, string applicationAnchor = "anchor-1")
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new
        {
            alg = "RS256",
            typ = TokenVerifier.AccessTokenType,
            kid = "key-1",
        };
        var body = new
        {
            iss = "https://connect-api.sudomimus.com",
            aud = applicationAnchor,
            sub = "subject-1",
            sid = "session-1",
            jti = "access-1",
            iat,
            exp = iat + 3600,
        };
        return MintToken(header, body, privateKeyPem);
    }

    public static string MintRefreshToken(string privateKeyPem, string applicationAnchor = "anchor-1")
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new
        {
            alg = "RS256",
            typ = TokenVerifier.RefreshTokenType,
            kid = "key-1",
        };
        var body = new
        {
            iss = "https://connect-api.sudomimus.com",
            aud = applicationAnchor,
            sid = "session-1",
            jti = "refresh-1",
            iat,
            exp = iat + 30 * 24 * 3600,
            rotationVersion = 1,
        };
        return MintToken(header, body, privateKeyPem);
    }

    private static string StripPadding(string b64) => b64.TrimEnd('=');
}
