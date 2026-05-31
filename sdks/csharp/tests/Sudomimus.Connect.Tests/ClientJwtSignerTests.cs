using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Sudomimus.Connect.Tests;

public class ClientJwtSignerTests
{
    [Fact]
    public void Sha256Base64_MatchesStandardBase64OfSha256()
    {
        const string input = "hello-world";
        var expected = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
        Assert.Equal(expected, ClientJwtSigner.Sha256Base64(input));
    }

    [Fact]
    public void Sign_EmitsClaimsInBody_NotHeader()
    {
        using var rsa = RSA.Create(2048);
        var pem = rsa.ExportPkcs8PrivateKeyPem();

        var jwt = ClientJwtSigner.Sign(
            new ConnectClientAuthWithKey
            {
                ApplicationAnchor = "anchor-1",
                PrivateKeyPem = pem,
                LifetimeSeconds = 30,
                JtiGenerator = () => "jti-fixed",
            },
            rawBody: """{"applicationAnchor":"anchor-1"}""",
            now: DateTimeOffset.FromUnixTimeSeconds(1_700_000_000));

        var segments = jwt.Split('.');
        Assert.Equal(3, segments.Length);

        var header = JsonDocument.Parse(DecodeBase64Url(segments[0])).RootElement;
        Assert.Equal("RS256", header.GetProperty("alg").GetString());
        Assert.Equal("JWT", header.GetProperty("typ").GetString());
        Assert.False(header.TryGetProperty("iss", out _), "iss must live in body, not header");

        var body = JsonDocument.Parse(DecodeBase64Url(segments[1])).RootElement;
        Assert.Equal("anchor-1", body.GetProperty("iss").GetString());
        Assert.Equal("sudomimus-connect", body.GetProperty("aud").GetString());
        Assert.Equal(1_700_000_000, body.GetProperty("iat").GetInt64());
        Assert.Equal(1_700_000_030, body.GetProperty("exp").GetInt64());
        Assert.Equal("jti-fixed", body.GetProperty("jti").GetString());
        Assert.Equal(
            ClientJwtSigner.Sha256Base64("""{"applicationAnchor":"anchor-1"}"""),
            body.GetProperty("body_sha256").GetString());
    }

    [Fact]
    public void Sign_ProducesVerifiableSignature()
    {
        using var rsa = RSA.Create(2048);
        var pem = rsa.ExportPkcs8PrivateKeyPem();

        var jwt = ClientJwtSigner.Sign(
            new ConnectClientAuthWithKey { ApplicationAnchor = "anchor-1", PrivateKeyPem = pem },
            rawBody: "{}",
            now: DateTimeOffset.UtcNow);

        var segments = jwt.Split('.');
        var signingInput = Encoding.ASCII.GetBytes($"{segments[0]}.{segments[1]}");
        var signature = DecodeBase64UrlBytes(segments[2]);

        Assert.True(rsa.VerifyData(
            signingInput,
            signature,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(61)]
    public void Sign_RejectsOutOfRangeLifetime(int lifetime)
    {
        using var rsa = RSA.Create(2048);
        var pem = rsa.ExportPkcs8PrivateKeyPem();

        Assert.Throws<ConnectConfigException>(() => ClientJwtSigner.Sign(
            new ConnectClientAuthWithKey
            {
                ApplicationAnchor = "anchor-1",
                PrivateKeyPem = pem,
                LifetimeSeconds = lifetime,
            },
            rawBody: "{}",
            now: DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task EstablishAsync_SendsAuthorizationHeader_AndBodyHashMatches()
    {
        using var rsa = RSA.Create(2048);
        var pem = rsa.ExportPkcs8PrivateKeyPem();

        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            {
                "applicationAnchor": "anchor-1",
                "exposureKey": "ek",
                "hiddenKey": "hk"
            }
            """);

        var client = new ConnectClient(new ConnectClientOptions
        {
            BaseUrl = "https://connect.example.com",
            HttpClient = new HttpClient(handler),
            ClientAuth = new ConnectClientAuthWithKey
            {
                ApplicationAnchor = "anchor-1",
                PrivateKeyPem = pem,
            },
        });

        var resp = await client.EstablishAsync(new EstablishRequest
        {
            ApplicationAnchor = "anchor-1",
        });
        Assert.Equal("ek", resp.ExposureKey);

        var req = Assert.Single(handler.Requests);
        Assert.Equal("SudomimusClientJWT", req.AuthScheme);
        Assert.False(string.IsNullOrEmpty(req.AuthParameter));

        // The JWT body_sha256 claim MUST equal SHA-256(raw HTTP body).
        var bodyClaim = JsonDocument
            .Parse(DecodeBase64Url(req.AuthParameter!.Split('.')[1]))
            .RootElement.GetProperty("body_sha256").GetString();
        Assert.Equal(ClientJwtSigner.Sha256Base64(req.Body!), bodyClaim);
    }

    [Fact]
    public async Task RevokeAllAsync_UsesByoSignerWhenConfigured()
    {
        var capturedRawBody = "";
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "revokedCount": 3 }""");

        var client = new ConnectClient(new ConnectClientOptions
        {
            BaseUrl = "https://connect.example.com",
            HttpClient = new HttpClient(handler),
            ClientAuth = new ConnectClientAuthWithSigner
            {
                ApplicationAnchor = "anchor-1",
                Signer = (rawBody, ct) =>
                {
                    capturedRawBody = rawBody;
                    return Task.FromResult("external.signed.jwt");
                },
            },
        });

        var resp = await client.RevokeAllAsync(new RevokeAllRequest
        {
            Subject = "subject-1",
        });
        Assert.Equal(3, resp.RevokedCount);

        var req = Assert.Single(handler.Requests);
        Assert.Equal("external.signed.jwt", req.AuthParameter);
        // Signer was called with the exact bytes that went on the wire.
        Assert.Equal(req.Body, capturedRawBody);
    }

    private static string DecodeBase64Url(string segment)
        => Encoding.UTF8.GetString(DecodeBase64UrlBytes(segment));

    private static byte[] DecodeBase64UrlBytes(string segment)
    {
        var padded = segment.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
