using System.Net;
using System.Text.Json;
using Sudomimus.Native;
using Xunit;

namespace Sudomimus.Native.Tests;

public class NativeClientTests
{
    private const string ValidAccessKeyIdentifier = "acs_k_01890c5e-1234-4abc-9def-0123456789ab";
    private static readonly string ValidAccessKeySecret = "acs_t_" + new string('a', 64);

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
                "refreshToken": "r-jwt",
                "claims": {
                    "email": { "requirement": "REQUIRED", "state": "GRANTED" },
                    "firstName": { "requirement": "OPTIONAL", "state": "DENIED" },
                    "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "avatar": { "requirement": "OFF", "state": "UNKNOWN" }
                }
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
        Assert.Equal(ClaimRequirement.Required, response.Claims.Email.Requirement);
        Assert.Equal(ClaimGrantState.Granted, response.Claims.Email.State);
        Assert.Equal(ClaimRequirement.Optional, response.Claims.FirstName.Requirement);
        Assert.Equal(ClaimGrantState.Denied, response.Claims.FirstName.State);
        Assert.Equal(ClaimRequirement.Off, response.Claims.LastName.Requirement);

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
    public async Task DirectIssueAccessKeyAsync_PostsExpectedRequestAndParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            {
                "applicationAnchor": "anchor-1",
                "accessToken": "a-jwt",
                "refreshToken": "r-jwt",
                "claims": {
                    "email": { "requirement": "OFF", "state": "UNKNOWN" },
                    "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "avatar": { "requirement": "OFF", "state": "UNKNOWN" }
                }
            }
            """);
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var response = await client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
        {
            ApplicationAnchor = "anchor-1",
            AccessKeyIdentifier = ValidAccessKeyIdentifier,
            AccessKeySecret = ValidAccessKeySecret,
        });

        Assert.Equal("anchor-1", response.ApplicationAnchor);
        Assert.Equal("a-jwt", response.AccessToken);
        Assert.Equal("r-jwt", response.RefreshToken);
        Assert.Equal(ClaimRequirement.Off, response.Claims.Email.Requirement);
        Assert.Equal(ClaimGrantState.Unknown, response.Claims.Email.State);

        var sentRequest = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, sentRequest.Method);
        Assert.Equal(
            "https://native.example.com/direct-issue/access-key",
            sentRequest.RequestUri!.ToString());

        Assert.NotNull(sentRequest.Body);
        using var parsed = JsonDocument.Parse(sentRequest.Body!);
        Assert.Equal("anchor-1", parsed.RootElement.GetProperty("applicationAnchor").GetString());
        Assert.Equal(
            ValidAccessKeyIdentifier,
            parsed.RootElement.GetProperty("accessKeyIdentifier").GetString());
        Assert.Equal(
            ValidAccessKeySecret,
            parsed.RootElement.GetProperty("accessKeySecret").GetString());
    }

    [Fact]
    public async Task DirectIssueAccessKeyAsync_Throws401_WithOpaqueAccessKeyDirectDenied()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, """{ "reason": "AccessKeyDirectDenied" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = "anchor-1",
                AccessKeyIdentifier = ValidAccessKeyIdentifier,
                AccessKeySecret = ValidAccessKeySecret,
            }));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
        Assert.Equal("AccessKeyDirectDenied", ex.Reason);
    }

    [Fact]
    public async Task DirectIssueAccessKeyAsync_Throws403_OnLayerDenied()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, """{ "reason": "Layer2Denied" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = "anchor-1",
                AccessKeyIdentifier = ValidAccessKeyIdentifier,
                AccessKeySecret = ValidAccessKeySecret,
            }));

        Assert.Equal(HttpStatusCode.Forbidden, ex.StatusCode);
        Assert.Equal("Layer2Denied", ex.Reason);
    }

    [Fact]
    public void Constants_ExposeSteamTicketIdentity()
    {
        // Server-side code in clients/native-api/src/steam/verify-ticket.ts
        // hardcodes the same value. Drift here breaks all Steam logins.
        Assert.Equal("sudomimus", NativeConstants.SteamTicketIdentity);
    }

    [Fact]
    public async Task DirectIssue_Throws403_ClaimGate_ExposesClaimsAndErrand()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, """
            {
                "reason": "ClaimConsentRequired",
                "claims": {
                    "email": { "requirement": "REQUIRED", "state": "UNKNOWN" },
                    "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "avatar": { "requirement": "OFF", "state": "UNKNOWN" }
                },
                "errand": {
                    "errandKey": "ernd_courier-route-abcdef012345-seal",
                    "url": "https://via.sudomimus.com/errand?key=ernd_courier-route-abcdef012345-seal",
                    "expiresAt": "2026-06-10T12:30:00.000Z"
                }
            }
            """);
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
        Assert.Equal(NativeReason.ClaimConsentRequired, ex.Reason);
        Assert.True(ex.IsClaimGate);

        Assert.NotNull(ex.Claims);
        Assert.Equal(ClaimRequirement.Required, ex.Claims!.Email.Requirement);
        Assert.Equal(ClaimGrantState.Unknown, ex.Claims.Email.State);

        Assert.NotNull(ex.Errand);
        Assert.Equal("ernd_courier-route-abcdef012345-seal", ex.Errand!.ErrandKey);
        Assert.Equal(
            "https://via.sudomimus.com/errand?key=ernd_courier-route-abcdef012345-seal",
            ex.Errand.Url);
        Assert.Equal(
            new DateTimeOffset(2026, 6, 10, 12, 30, 0, TimeSpan.Zero),
            ex.Errand.ExpiresAt);
    }

    [Fact]
    public async Task DirectIssue_Throws403_LayerDenied_IsNotClaimGate()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, """{ "reason": "Layer2Denied" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() =>
            client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = "anchor-1",
                AccessKeyIdentifier = ValidAccessKeyIdentifier,
                AccessKeySecret = ValidAccessKeySecret,
            }));

        Assert.Equal(NativeReason.Layer2Denied, ex.Reason);
        Assert.False(ex.IsClaimGate);
        Assert.Null(ex.Claims);
        Assert.Null(ex.Errand);
    }

    [Fact]
    public async Task GetErrandStatusAsync_GetsExpectedUrlAndParsesStatus()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "COMPLETED" }""");
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var response = await client.GetErrandStatusAsync("ernd_courier-route-abcdef012345-seal");

        Assert.Equal(ErrandStatus.Completed, response.Status);

        var sentRequest = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Get, sentRequest.Method);
        Assert.Equal(
            "https://native.example.com/errand/ernd_courier-route-abcdef012345-seal/status",
            sentRequest.RequestUri!.ToString());
        Assert.Null(sentRequest.Body);
    }

    [Fact]
    public async Task GetErrandStatusAsync_Throws_OnNullOrEmptyKey()
    {
        using var http = new HttpClient(new FakeHttpMessageHandler());
        var client = new NativeClient("https://native.example.com", http);

        await Assert.ThrowsAsync<ArgumentException>(() => client.GetErrandStatusAsync(""));
    }

    [Fact]
    public async Task CreateErrandAsync_PostsExpectedRequestAndParsesResponse()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """
            {
                "errand": {
                    "errandKey": "ernd_courier-route-abcdef012345-seal",
                    "url": "https://via.sudomimus.com/errand?key=ernd_courier-route-abcdef012345-seal",
                    "expiresAt": "2026-06-10T12:30:00.000Z"
                },
                "claims": {
                    "email": { "requirement": "REQUIRED", "state": "UNKNOWN" },
                    "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                    "avatar": { "requirement": "OFF", "state": "UNKNOWN" }
                }
            }
            """);
        using var http = new HttpClient(handler);
        var client = new NativeClient("https://native.example.com", http);

        var response = await client.CreateErrandAsync(new CreateErrandRequest
        {
            AccessToken = "a-jwt",
        });

        Assert.NotNull(response.Errand);
        Assert.Equal("ernd_courier-route-abcdef012345-seal", response.Errand.ErrandKey);
        Assert.Equal(ClaimRequirement.Required, response.Claims.Email.Requirement);

        var sentRequest = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, sentRequest.Method);
        Assert.Equal(
            "https://native.example.com/errand",
            sentRequest.RequestUri!.ToString());

        Assert.NotNull(sentRequest.Body);
        using var parsed = JsonDocument.Parse(sentRequest.Body!);
        Assert.Equal("a-jwt", parsed.RootElement.GetProperty("accessToken").GetString());
    }
}
