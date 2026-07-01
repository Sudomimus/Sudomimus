using System.Net;
using Sudomimus.Native;
using Xunit;

namespace Sudomimus.Native.Tests;

public class NativeAuthenticatorTests
{
    private const string ErrandKey = "ernd_courier-route-abcdef012345-seal";
    private const string ErrandUrl = "https://via.sudomimus.com/errand?key=ernd_courier-route-abcdef012345-seal";
    private const string ValidAccessKeyIdentifier = "acs_k_01890c5e-1234-4abc-9def-0123456789ab";
    private static readonly string ValidAccessKeySecret = "acs_t_" + new string('a', 64);

    private const string Gate403 = """
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
        """;

    private const string Success200 = """
        {
            "applicationAnchor": "anchor-1",
            "accessToken": "a-jwt",
            "refreshToken": "r-jwt",
            "claims": {
                "email": { "requirement": "REQUIRED", "state": "GRANTED" },
                "firstName": { "requirement": "OFF", "state": "UNKNOWN" },
                "lastName": { "requirement": "OFF", "state": "UNKNOWN" },
                "avatar": { "requirement": "OFF", "state": "UNKNOWN" }
            }
        }
        """;

    [Fact]
    public async Task AuthenticateAsync_Succeeds_WithoutErrand_DoesNotOpenBrowser()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, Success200);
        using var http = new HttpClient(handler);
        var (auth, opened) = NewAuth(http);

        var result = await auth.AuthenticateAccessKeyAsync(Req());

        Assert.Equal("a-jwt", result.AccessToken);
        Assert.Equal("r-jwt", result.RefreshToken);
        Assert.Equal(ClaimGrantState.Granted, result.Claims.Email.State);
        Assert.Empty(opened);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task AuthenticateAsync_RecoversViaErrand_OpensPollsAndRetries()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "COMPLETED" }""");
        handler.Enqueue(HttpStatusCode.OK, Success200);
        using var http = new HttpClient(handler);
        var phases = new List<ErrandPhase>();
        var (auth, opened) = NewAuth(http, progress: new Progress<ErrandProgress>(p => phases.Add(p.Phase)));

        var result = await auth.AuthenticateAccessKeyAsync(Req());

        Assert.Equal("a-jwt", result.AccessToken);

        // Browser opened exactly once, with the errand URL.
        Assert.Equal(ErrandUrl, Assert.Single(opened).ToString());

        // The wire trace: POST direct-issue -> GET errand status -> POST retry.
        Assert.Equal(3, handler.Requests.Count);
        Assert.Equal(HttpMethod.Post, handler.Requests[0].Method);
        Assert.Equal(HttpMethod.Get, handler.Requests[1].Method);
        Assert.Equal(
            $"https://native.example.com/errand/{ErrandKey}/status",
            handler.Requests[1].RequestUri!.ToString());
        Assert.Equal(HttpMethod.Post, handler.Requests[2].Method);
    }

    [Fact]
    public async Task TryAuthenticateAsync_OpensBrowser_ReturnsErrandRequired_DoesNotPoll()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        using var http = new HttpClient(handler);
        var (auth, opened) = NewAuth(http);

        var outcome = await auth.TryAuthenticateAccessKeyAsync(Req());

        var errandRequired = Assert.IsType<DirectIssueOutcome.ErrandRequired>(outcome);
        Assert.Equal(ErrandKey, errandRequired.Errand.ErrandKey);
        Assert.Equal(NativeReason.ClaimConsentRequired, errandRequired.Reason);
        Assert.Equal(ClaimRequirement.Required, errandRequired.Claims.Email.Requirement);

        // Browser opened, but no polling and no retry — exactly one request.
        Assert.Equal(ErrandUrl, Assert.Single(opened).ToString());
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task TryAuthenticateAsync_SecondCall_AfterUserFinishes_Authenticates()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        handler.Enqueue(HttpStatusCode.OK, Success200);
        using var http = new HttpClient(handler);
        var (auth, opened) = NewAuth(http);

        var first = await auth.TryAuthenticateAccessKeyAsync(Req());
        Assert.IsType<DirectIssueOutcome.ErrandRequired>(first);

        // The app drives its own retry once the user signals completion.
        var second = await auth.TryAuthenticateAccessKeyAsync(Req());

        var authenticated = Assert.IsType<DirectIssueOutcome.Authenticated>(second);
        Assert.Equal("a-jwt", authenticated.Result.AccessToken);
        Assert.Single(opened);
    }

    [Fact]
    public async Task AuthenticateAsync_NonClaimGate_Bubbles_DoesNotOpenBrowser()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, """{ "reason": "Layer1Denied" }""");
        using var http = new HttpClient(handler);
        var (auth, opened) = NewAuth(http);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() => auth.AuthenticateAccessKeyAsync(Req()));

        Assert.Equal(NativeReason.Layer1Denied, ex.Reason);
        Assert.False(ex.IsClaimGate);
        Assert.Empty(opened);
    }

    [Fact]
    public async Task AuthenticateAsync_ExhaustsRounds_Throws()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "COMPLETED" }""");
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        using var http = new HttpClient(handler);
        var (auth, opened) = NewAuth(http, maxRounds: 1);

        var ex = await Assert.ThrowsAsync<NativeApiException>(() => auth.AuthenticateAccessKeyAsync(Req()));

        Assert.True(ex.IsClaimGate);
        Assert.Single(opened); // only the single allowed recovery opened a browser
    }

    [Fact]
    public async Task AuthenticateAsync_PollTimeout_Throws()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Forbidden, Gate403);
        handler.Enqueue(HttpStatusCode.OK, """{ "status": "PENDING" }""");
        using var http = new HttpClient(handler);

        var baseTime = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var calls = 0;
        var (auth, opened) = NewAuth(
            http,
            pollTimeout: TimeSpan.FromSeconds(30),
            clock: () => baseTime.AddSeconds(60 * calls++));

        var ex = await Assert.ThrowsAsync<ErrandPollTimeoutException>(() => auth.AuthenticateAccessKeyAsync(Req()));

        Assert.Equal(ErrandKey, ex.Errand.ErrandKey);
        Assert.Single(opened);
    }

    private static DirectIssueAccessKeyRequest Req() => new()
    {
        ApplicationAnchor = "anchor-1",
        AccessKeyIdentifier = ValidAccessKeyIdentifier,
        AccessKeySecret = ValidAccessKeySecret,
    };

    private static (NativeAuthenticator Auth, List<Uri> Opened) NewAuth(
        HttpClient http,
        int maxRounds = 2,
        TimeSpan? pollTimeout = null,
        Func<DateTimeOffset>? clock = null,
        IProgress<ErrandProgress>? progress = null)
    {
        var client = new NativeClient("https://native.example.com", http);
        var opened = new List<Uri>();
        var options = new NativeAuthenticatorOptions
        {
            OpenUrl = (uri, _) =>
            {
                opened.Add(uri);
                return Task.CompletedTask;
            },
            PollInterval = TimeSpan.FromMilliseconds(1),
            PollTimeout = pollTimeout ?? TimeSpan.FromMinutes(30),
            MaxErrandRounds = maxRounds,
            Clock = clock ?? (() => DateTimeOffset.UtcNow),
            Progress = progress,
        };
        return (new NativeAuthenticator(client, options), opened);
    }
}
