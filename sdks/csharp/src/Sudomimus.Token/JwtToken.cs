using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Sudomimus.Token;

/// <summary>
/// A parsed Sudomimus JWT. Exposes the header (envelope claims), body
/// (caller-specific claims), and signing input so callers can re-verify
/// signatures with their own public key.
/// </summary>
/// <typeparam name="TBody">The body claim shape, e.g. <see cref="AccessTokenBody"/>.</typeparam>
public sealed class JwtToken<TBody>
    where TBody : class
{
    /// <summary>The raw, dot-joined JWT exactly as received on the wire.</summary>
    public string Raw { get; }

    /// <summary>
    /// The exact bytes that the signature signs:
    /// <c>headerSegment + "." + bodySegment</c>, UTF-8 encoded. Required
    /// for signature verification because <c>@sudoo/jwt</c> uses a
    /// non-standard mix of base64 (header/body) and base64url (signature)
    /// — re-encoding from the decoded header/body would not match.
    /// </summary>
    public byte[] SigningInput { get; }

    /// <summary>Raw base64url-decoded signature bytes.</summary>
    public byte[] Signature { get; }

    public JwtHeader Header { get; }
    public TBody Body { get; }

    internal JwtToken(string raw, byte[] signingInput, byte[] signature, JwtHeader header, TBody body)
    {
        Raw = raw;
        SigningInput = signingInput;
        Signature = signature;
        Header = header;
        Body = body;
    }

    /// <summary>
    /// Verify the signature with the given PEM-encoded RSA public key.
    /// Returns <c>true</c> when the signature matches.
    /// </summary>
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

    /// <summary>
    /// Verify the token's <c>exp</c> claim against the given moment.
    /// Returns <c>true</c> when the token has not yet expired.
    /// </summary>
    public bool VerifyExpiration(DateTimeOffset now)
    {
        if (Header.ExpiresAt is null)
        {
            return false;
        }
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(Header.ExpiresAt.Value);
        return now < expiresAt;
    }
}

/// <summary>
/// Implements the on-wire JWT layout used by <c>@sudoo/jwt</c>:
/// <list type="bullet">
///   <item><description>Header segment: standard base64 of JSON, <c>=</c> padding stripped.</description></item>
///   <item><description>Body segment: standard base64 of JSON, <c>=</c> padding stripped.</description></item>
///   <item><description>Signature segment: base64url of RSA-SHA256 bytes, <c>=</c> padding stripped.</description></item>
///   <item><description>Signing input: literal <c>headerSegment.bodySegment</c> string, UTF-8.</description></item>
/// </list>
/// </summary>
internal static class JwtCodec
{
    public static string EncodeJsonSegment<T>(T value, JsonSerializerOptions? options = null)
    {
        var json = JsonSerializer.Serialize(value, options);
        var bytes = Encoding.UTF8.GetBytes(json);
        return StripPadding(Convert.ToBase64String(bytes));
    }

    public static byte[] DecodeStandardBase64Segment(string segment)
    {
        var padded = PadBase64(segment);
        return Convert.FromBase64String(padded);
    }

    public static byte[] DecodeBase64UrlSegment(string segment)
    {
        var translated = segment.Replace('-', '+').Replace('_', '/');
        return DecodeStandardBase64Segment(translated);
    }

    public static string EncodeBase64UrlSignature(byte[] signature)
    {
        var b64 = StripPadding(Convert.ToBase64String(signature));
        return b64.Replace('+', '-').Replace('/', '_');
    }

    private static string StripPadding(string b64) => b64.TrimEnd('=');

    private static string PadBase64(string b64)
    {
        var remainder = b64.Length % 4;
        return remainder == 0 ? b64 : b64 + new string('=', 4 - remainder);
    }
}
