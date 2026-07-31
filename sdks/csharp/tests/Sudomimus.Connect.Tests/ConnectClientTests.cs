using System.Net;
using System.Text.Json;
using Xunit;

namespace Sudomimus.Connect.Tests;

public class ConnectClientTests
{
    [Fact]
    public void Constructor_NormalizesBaseUrlTrailingSlash()
    {
        using var http = new HttpClient();
        var client = new ConnectClient(new ConnectClientOptions
        {
            BaseUrl = "https://connect.example.com/",
            HttpClient = http,
        });
        Assert.Equal("https://connect.example.com", client.BaseUrl);
    }

    [Fact]
    public async Task HealthAsync_ParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            { "status": "ok", "service": "connect", "version": "0.2.0" }
            """);
        var client = NewClient(handler);

        var resp = await client.HealthAsync();

        Assert.Equal(HealthStatus.Ok, resp.Status);
        Assert.Equal("connect", resp.Service);
        Assert.Equal("0.2.0", resp.Version);

        var req = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Get, req.Method);
        Assert.Equal("https://connect.example.com/health", req.RequestUri!.ToString());
    }

    [Fact]
    public async Task StatusPollAsync_DeserializesPending()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "PENDING" }""");
        var client = NewClient(handler);

        var resp = await client.StatusPollAsync(new StatusPollRequest
        {
            ExposureKey = "ek",
            HiddenKey = "hk",
        });

        Assert.IsType<StatusPollPendingResponse>(resp);
    }

    [Fact]
    public async Task StatusPollAsync_DeserializesRealized()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            { "status": "REALIZED", "confirmationKey": "ck-123" }
            """);
        var client = NewClient(handler);

        var resp = await client.StatusPollAsync(new StatusPollRequest
        {
            ExposureKey = "ek",
            HiddenKey = "hk",
        });

        var realized = Assert.IsType<StatusPollRealizedResponse>(resp);
        Assert.Equal("ck-123", realized.ConfirmationKey);
    }

    [Fact]
    public async Task RedeemAsync_PostsExpectedRequestAndParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            {
                "applicationAnchor": "anchor-1",
                "refreshToken": "r-jwt",
                "accessToken": "a-jwt",
                "claims": {
                    "email": { "requirement": "REQUIRED", "state": "GRANTED" },
                    "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "staticAvatar": { "requirement": "OFF", "state": "UNKNOWN" },
                    "animatedAvatar": { "requirement": "OFF", "state": "UNKNOWN" }
                }
            }
            """);
        var client = NewClient(handler);

        var resp = await client.RedeemAsync(new RedeemRequest
        {
            ExposureKey = "ek",
            HiddenKey = "hk",
            ConfirmationKey = "ck",
        });

        Assert.Equal("anchor-1", resp.ApplicationAnchor);
        Assert.Equal("a-jwt", resp.AccessToken);
        Assert.Equal(ClaimRequirement.Required, resp.Claims.Email.Requirement);
        Assert.Equal(ClaimGrantState.Granted, resp.Claims.Email.State);

        var req = Assert.Single(handler.Requests);
        Assert.Equal("https://connect.example.com/redeem", req.RequestUri!.ToString());
        using var parsed = JsonDocument.Parse(req.Body!);
        Assert.Equal("ek", parsed.RootElement.GetProperty("exposureKey").GetString());
        Assert.Equal("hk", parsed.RootElement.GetProperty("hiddenKey").GetString());
        Assert.Equal("ck", parsed.RootElement.GetProperty("confirmationKey").GetString());
    }

    [Fact]
    public async Task ApiError_Parsed_FromResponseBody()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.BadRequest, """{ "reason": "InquiryEmptyConstraints" }""");
        var client = NewClient(handler);

        var ex = await Assert.ThrowsAsync<ConnectApiException>(() =>
            client.RedeemAsync(new RedeemRequest
            {
                ExposureKey = "ek",
                HiddenKey = "hk",
                ConfirmationKey = "ck",
            }));

        Assert.Equal(HttpStatusCode.BadRequest, ex.StatusCode);
        Assert.Equal("InquiryEmptyConstraints", ex.Reason);
    }

    [Fact]
    public async Task ApiError_NullReason_WhenBodyEmpty()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, null);
        var client = NewClient(handler);

        var ex = await Assert.ThrowsAsync<ConnectApiException>(() =>
            client.HealthAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
        Assert.Null(ex.Reason);
        Assert.Null(ex.Body);
    }

    // ───────── Client-auth guard ─────────

    [Fact]
    public async Task EstablishAsync_WithoutClientAuth_Throws()
    {
        var handler = new FakeHttpMessageHandler();
        var client = NewClient(handler);

        await Assert.ThrowsAsync<ConnectConfigException>(() =>
            client.EstablishAsync(new EstablishRequest { ApplicationAnchor = "anchor-1" }));

        Assert.Empty(handler.Requests);
    }

    // ───────── helpers ─────────

    private static ConnectClient NewClient(FakeHttpMessageHandler handler)
    {
        return new ConnectClient(new ConnectClientOptions
        {
            BaseUrl = "https://connect.example.com",
            HttpClient = new HttpClient(handler),
        });
    }

}
