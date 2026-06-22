using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Sudomimus.Session.Tests;

public class SessionClientTests
{
    [Fact]
    public void Constructor_NormalizesBaseUrlTrailingSlash()
    {
        using var http = new HttpClient();
        var client = new SessionClient(new SessionClientOptions
        {
            BaseUrl = "https://session.example.com/",
            HttpClient = http,
        });
        Assert.Equal("https://session.example.com", client.BaseUrl);
    }

    [Fact]
    public async Task RefreshAsync_RoundTrips()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, RefreshResponseJson("new-a", "new-r"));
        var client = NewClient(handler);

        var resp = await client.RefreshAsync(new RefreshRequest { RefreshToken = "r" });

        Assert.Equal("new-a", resp.AccessToken);
        Assert.Equal("new-r", resp.RefreshToken);
        Assert.Equal(ClaimRequirement.Optional, resp.Claims.Email.Requirement);
        Assert.Equal(ClaimGrantState.Granted, resp.Claims.Email.State);
    }

    [Fact]
    public async Task IntrospectAsync_ParsesStatus()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "active", "recommendedRecheckSeconds": 30 }""");
        var client = NewClient(handler);

        var resp = await client.IntrospectAsync(new IntrospectRequest { AccessToken = "a" });

        Assert.Equal(IntrospectStatus.Active, resp.Status);
        Assert.Equal(30, resp.RecommendedRecheckSeconds);
    }

    [Fact]
    public async Task LogoutAsync_ReportsRevoked()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "revoked": true }""");
        var client = NewClient(handler);

        var resp = await client.LogoutAsync(new LogoutRequest { RefreshToken = "r" });

        Assert.True(resp.Revoked);
    }

    [Fact]
    public async Task HealthAsync_ParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "ready": true, "service": "session", "version": "1" }""");
        var client = NewClient(handler);

        var resp = await client.HealthAsync();

        Assert.True(resp.Ready);
        Assert.Equal("session", resp.Service);
    }

    [Fact]
    public async Task RevokeAllAsync_WithoutClientAuth_Throws()
    {
        var handler = new FakeHttpMessageHandler();
        var client = NewClient(handler);

        await Assert.ThrowsAsync<SessionConfigException>(() =>
            client.RevokeAllAsync(new RevokeAllRequest { Subject = "subject-1" }));
    }

    [Fact]
    public async Task RevokeAllAsync_UsesByoSignerWhenConfigured()
    {
        var capturedRawBody = "";
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "revokedCount": 3 }""");

        var client = new SessionClient(new SessionClientOptions
        {
            BaseUrl = "https://session.example.com",
            HttpClient = new HttpClient(handler),
            ClientAuth = new SessionClientAuthWithSigner
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
        Assert.Equal(req.Body, capturedRawBody);
    }

    [Fact]
    public void Sign_UsesSessionAudience()
    {
        using var rsa = RSA.Create(2048);
        var pem = rsa.ExportPkcs8PrivateKeyPem();

        var jwt = ClientJwtSigner.Sign(
            new SessionClientAuthWithKey
            {
                ApplicationAnchor = "anchor-1",
                PrivateKeyPem = pem,
                LifetimeSeconds = 30,
                JtiGenerator = () => "jti-fixed",
            },
            rawBody: """{"subject":"subject-1"}""",
            now: DateTimeOffset.FromUnixTimeSeconds(1_700_000_000));

        var body = JsonDocument.Parse(DecodeBase64Url(jwt.Split('.')[1])).RootElement;
        Assert.Equal("anchor-1", body.GetProperty("iss").GetString());
        Assert.Equal("sudomimus-session", body.GetProperty("aud").GetString());
        Assert.Equal(
            ClientJwtSigner.Sha256Base64("""{"subject":"subject-1"}"""),
            body.GetProperty("body_sha256").GetString());
    }

    [Fact]
    public async Task ApiError_NullReason_WhenBodyEmpty()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, null);
        var client = NewClient(handler);

        var ex = await Assert.ThrowsAsync<SessionApiException>(() => client.HealthAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
        Assert.Null(ex.Reason);
        Assert.Null(ex.Body);
    }

    private static SessionClient NewClient(FakeHttpMessageHandler handler)
    {
        return new SessionClient(new SessionClientOptions
        {
            BaseUrl = "https://session.example.com",
            HttpClient = new HttpClient(handler),
        });
    }

    private static string RefreshResponseJson(string accessToken, string refreshToken) =>
        $$"""
        {
            "accessToken": "{{accessToken}}",
            "refreshToken": "{{refreshToken}}",
            "claims": {
                "email": { "requirement": "OPTIONAL", "state": "GRANTED" },
                "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                "lastName": { "requirement": "OFF", "state": "UNKNOWN" }
            }
        }
        """;

    private static string DecodeBase64Url(string segment)
    {
        var padded = segment.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Encoding.UTF8.GetString(Convert.FromBase64String(padded));
    }
}
