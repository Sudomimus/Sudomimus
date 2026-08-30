using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Sudomimus.Native;

internal sealed record SignedPublicKeyRequest(byte[] Body, string Authorization);

internal static class PublicKeyAssertion
{
    internal const string Audience = "sudomimus-native-public-key";
    internal const string Type = "vnd.sudomimus.public-key-assertion+jwt";
    internal const string AuthorizationScheme = "SudomimusPublicKeyJWT";

    internal static async ValueTask<SignedPublicKeyRequest> SignAsync(
        DirectIssuePublicKeyRequest request,
        PublicKeyCredential credential,
        JsonSerializerOptions jsonOptions,
        CancellationToken cancellationToken)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(request, jsonOptions);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var jti = RandomNumberGenerator.GetBytes(16);
        var requestHash = SHA256.HashData(body);
        var header = new
        {
            alg = "EdDSA",
            typ = Type,
            kid = credential.KeyId,
        };
        var claims = new
        {
            iss = credential.KeyId,
            aud = Audience,
            iat = now,
            exp = now + 60,
            jti = Base64Url(jti),
            requestHash = Base64Url(requestHash),
        };
        var headerSegment = Base64Url(JsonSerializer.SerializeToUtf8Bytes(header, jsonOptions));
        var claimsSegment = Base64Url(JsonSerializer.SerializeToUtf8Bytes(claims, jsonOptions));
        var signingInput = Encoding.ASCII.GetBytes($"{headerSegment}.{claimsSegment}");
        var signature = await credential.SignAsync(signingInput, cancellationToken).ConfigureAwait(false);
        if (signature.Length != 64)
        {
            throw new ArgumentException("Ed25519 signatures must contain exactly 64 bytes.", nameof(credential));
        }

        var assertion = $"{headerSegment}.{claimsSegment}.{Base64Url(signature)}";
        return new SignedPublicKeyRequest(body, $"{AuthorizationScheme} {assertion}");
    }

    private static string Base64Url(ReadOnlySpan<byte> value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
