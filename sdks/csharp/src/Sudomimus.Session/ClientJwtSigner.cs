using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Sudomimus.Session;

/// <summary>
/// Builds and signs the client-auth JWT carried via
/// <c>Authorization: SudomimusClientJWT &lt;jwt&gt;</c>.
/// </summary>
/// <remarks>
/// All claims (<c>iss</c>, <c>aud</c>, <c>iat</c>, <c>exp</c>, <c>jti</c>,
/// <c>body_sha256</c>) are emitted in the JWT body (payload), not the
/// header. The server's <c>verifyEstablishClientJwt</c> reader inspects
/// the body — header-only claims would be ignored. The JWT header carries
/// only the standard <c>alg</c>/<c>typ</c> fields.
/// </remarks>
public static class ClientJwtSigner
{
    /// <summary>
    /// Standard base64 of <c>SHA-256(rawBody UTF-8 bytes)</c>. The server
    /// hashes the raw HTTP body the same way — any drift produces a
    /// <c>S_ClientJwtBodyHashMismatch</c> rejection.
    /// </summary>
    public static string Sha256Base64(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Sign a client-auth JWT for the given raw HTTP body. Returns the
    /// compact JWT (header.body.signature); the caller is responsible for
    /// prefixing it with the <c>SudomimusClientJWT</c> scheme.
    /// </summary>
    public static string Sign(
        SessionClientAuthWithKey config,
        string rawBody,
        DateTimeOffset now)
    {
        var lifetime = config.LifetimeSeconds ?? SessionConstants.ClientJwtDefaultLifetimeSeconds;
        if (lifetime <= 0 || lifetime > SessionConstants.ClientJwtMaxLifetimeSeconds)
        {
            throw new SessionConfigException(
                $"ClientAuth.LifetimeSeconds must be in (0, {SessionConstants.ClientJwtMaxLifetimeSeconds}]; got {lifetime}.");
        }

        var iat = now.ToUnixTimeSeconds();
        var exp = iat + lifetime;
        var jti = (config.JtiGenerator ?? (() => Guid.NewGuid().ToString()))();

        var claims = new Dictionary<string, object>
        {
            ["iss"] = config.ApplicationAnchor,
            ["aud"] = SessionConstants.ClientJwtAudience,
            ["iat"] = iat,
            ["exp"] = exp,
            ["jti"] = jti,
            ["body_sha256"] = Sha256Base64(rawBody),
        };

        var header = new Dictionary<string, object>
        {
            ["alg"] = "RS256",
            ["typ"] = "JWT",
        };

        var headerSegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header));
        var bodySegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(claims));
        var signingInput = $"{headerSegment}.{bodySegment}";

        using var rsa = RSA.Create();
        rsa.ImportFromPem(config.PrivateKeyPem);
        var signature = rsa.SignData(
            Encoding.ASCII.GetBytes(signingInput),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);

        return $"{signingInput}.{Base64UrlEncode(signature)}";
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
