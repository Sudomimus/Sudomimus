using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sudomimus.Token;

namespace Sudomimus.Token.Tests;

/// <summary>
/// Mirrors enough of <c>@sudoo/jwt</c>'s creator on the C# side to mint
/// fixture tokens that exercise the parser/verifier round-trip. Keeps the
/// JWT format identical to what the production token service emits.
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

    public static string MintAccessToken(string privateKeyPem, string applicationAnchor = "anchor-1")
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new
        {
            alg = "RS256",
            typ = "JWT",
            iss = "sudomimus.com",
            aud = applicationAnchor,
            iat,
            exp = iat + 3600,
            jti = "access-1",
            kty = "Access",
            sub = "refresh-1",
        };
        var body = new
        {
            accountIdentifier = "acct-1",
            firstName = "Ada",
            lastName = "Lovelace",
        };
        return MintToken(header, body, privateKeyPem);
    }

    public static string MintRefreshToken(string privateKeyPem, string applicationAnchor = "anchor-1")
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new
        {
            alg = "RS256",
            typ = "JWT",
            iss = "sudomimus.com",
            aud = applicationAnchor,
            iat,
            exp = iat + 30 * 24 * 3600,
            jti = "refresh-1",
            kty = "Refresh",
        };
        var body = new
        {
            accountIdentifier = "acct-1",
        };
        return MintToken(header, body, privateKeyPem);
    }

    private static string StripPadding(string b64) => b64.TrimEnd('=');
}
