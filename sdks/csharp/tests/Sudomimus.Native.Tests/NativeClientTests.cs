using System.Net;
using System.Text.Json;
using Sudomimus.Native;
using Xunit;

namespace Sudomimus.Native.Tests;

public class NativeClientTests
{
    [Fact]
    public void Constructor_NormalizesBaseUrlTrailingSlash()
    {
        using var http = new HttpClient();
        var client = new NativeClient("https://native.example.com/", http);
        Assert.Equal("https://native.example.com", client.BaseUrl);
    }

    [Fact]
    public async Task DirectIssueSteamTicketAsync_PostsExpectedRequestAndParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            {
                "applicationAnchor": "anchor-1",
                "accessToken": "a-jwt",
                "refreshToken": "r-jwt"
            }
            """);
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var response = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
        {
            ApplicationAnchor = "anchor-1",
            SteamTicketHex = "deadbeef",
            SteamAppId = 480,
        });

        Assert.Equal("anchor-1", response.ApplicationAnchor);
        Assert.Equal("a-jwt", response.AccessToken);
        Assert.Equal("r-jwt", response.RefreshToken);

        var sentRequest = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, sentRequest.Method);
        Assert.Equal(
            "https://native.example.com/direct-issue/steam-ticket",
            sentRequest.RequestUri!.ToString());

        Assert.NotNull(sentRequest.Body);
        using var parsed = JsonDocument.Parse(sentRequest.Body!);
        Assert.Equal("anchor-1", parsed.RootElement.GetProperty("applicationAnchor").GetString());
        Assert.Equal("deadbeef", parsed.RootElement.GetProperty("steamTicketHex").GetString());
        Assert.Equal(480, parsed.RootElement.GetProperty("steamAppId").GetInt64());
    }

    [Fact]
    public async Task DirectIssueSteamTicketAsync_Throws403_WithLayerDeniedReason()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, """{ "reason": "Layer1Denied" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = "anchor-1",
                SteamTicketHex = "deadbeef",
                SteamAppId = 480,
            }));

        Assert.Equal(HttpStatusCode.Forbidden, ex.StatusCode);
        Assert.Equal("Layer1Denied", ex.Reason);
    }

    [Fact]
    public async Task DirectIssueSteamTicketAsync_Throws409_OnReplayConflict()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Conflict, """{ "reason": "ReplayProtectionAlreadySeen" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = "anchor-1",
                SteamTicketHex = "deadbeef",
                SteamAppId = 480,
            }));

        Assert.Equal(HttpStatusCode.Conflict, ex.StatusCode);
        Assert.Equal("ReplayProtectionAlreadySeen", ex.Reason);
    }

    [Fact]
    public async Task DirectIssueSteamTicketAsync_ReasonIsNull_WhenErrorBodyEmpty()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, null);
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = "anchor-1",
                SteamTicketHex = "deadbeef",
                SteamAppId = 480,
            }));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
        Assert.Null(ex.Reason);
        Assert.Null(ex.Body);
    }

    [Fact]
    public void Constants_ExposeSteamTicketIdentity()
    {
        // Server-side code in clients/native-api/src/steam/verify-ticket.ts
        // hardcodes the same value. Drift here breaks all Steam logins.
        Assert.Equal("sudomimus", NativeConstants.SteamTicketIdentity);
    }
}
