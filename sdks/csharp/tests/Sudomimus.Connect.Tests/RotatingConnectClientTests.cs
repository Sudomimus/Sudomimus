using System.Net;
using System.Text.Json;
using Xunit;

namespace Sudomimus.Connect.Tests;

public class RotatingConnectClientTests
{
    [Fact]
    public async Task GetAccessTokenAsync_ReturnsNullWhenEmpty()
    {
        var wrapper = new RotatingConnectClient(NewClient(new FakeHttpMessageHandler()), new InMemoryTokenStore());

        Assert.Null(await wrapper.GetAccessTokenAsync());
        Assert.Null(await wrapper.GetTokensAsync());
    }

    [Fact]
    public async Task SeedAsync_PersistsInitialPair()
    {
        var wrapper = new RotatingConnectClient(NewClient(new FakeHttpMessageHandler()), new InMemoryTokenStore());

        await wrapper.SeedAsync(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });

        Assert.Equal("a1", await wrapper.GetAccessTokenAsync());
        var tokens = await wrapper.GetTokensAsync();
        Assert.NotNull(tokens);
        Assert.Equal("a1", tokens!.AccessToken);
        Assert.Equal("r1", tokens.RefreshToken);
    }

    [Fact]
    public async Task RefreshAsync_RotatesAndPersistsNewPair()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "accessToken": "a2", "refreshToken": "r2" }""");
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });
        var wrapper = new RotatingConnectClient(NewClient(handler), store);

        var next = await wrapper.RefreshAsync();

        Assert.Equal("a2", next);
        var stored = await store.LoadAsync();
        Assert.Equal("a2", stored!.AccessToken);
        Assert.Equal("r2", stored.RefreshToken);

        var sent = JsonDocument.Parse(handler.Requests[0].Body!);
        Assert.Equal("r1", sent.RootElement.GetProperty("refreshToken").GetString());
    }

    [Fact]
    public async Task RefreshAsync_ThrowsWhenStoreIsEmpty()
    {
        var handler = new FakeHttpMessageHandler();
        var wrapper = new RotatingConnectClient(NewClient(handler), new InMemoryTokenStore());

        await Assert.ThrowsAsync<ConnectConfigException>(() => wrapper.RefreshAsync());
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task RefreshAsync_CoalescesConcurrentCalls()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "accessToken": "a2", "refreshToken": "r2" }""");
        var wrapper = new RotatingConnectClient(
            NewClient(handler),
            new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" }));

        var t1 = wrapper.RefreshAsync();
        var t2 = wrapper.RefreshAsync();
        var t3 = wrapper.RefreshAsync();
        var results = await Task.WhenAll(t1, t2, t3);

        Assert.All(results, r => Assert.Equal("a2", r));
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task RefreshAsync_ReleasesInFlightSlotOnSuccess()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "accessToken": "a2", "refreshToken": "r2" }""");
        handler.Enqueue(HttpStatusCode.OK, """{ "accessToken": "a3", "refreshToken": "r3" }""");
        var wrapper = new RotatingConnectClient(
            NewClient(handler),
            new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" }));

        await wrapper.RefreshAsync();
        var next = await wrapper.RefreshAsync();

        Assert.Equal("a3", next);
        Assert.Equal(2, handler.Requests.Count);
        var secondSent = JsonDocument.Parse(handler.Requests[1].Body!);
        Assert.Equal("r2", secondSent.RootElement.GetProperty("refreshToken").GetString());
    }

    [Fact]
    public async Task RefreshAsync_ReleasesInFlightSlotOnFailure()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, """{ "reason": "RefreshTokenFamilyCompromised" }""");
        handler.Enqueue(HttpStatusCode.OK, """{ "accessToken": "a2", "refreshToken": "r2" }""");
        var wrapper = new RotatingConnectClient(
            NewClient(handler),
            new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" }));

        await Assert.ThrowsAsync<ConnectApiException>(() => wrapper.RefreshAsync());

        var next = await wrapper.RefreshAsync();
        Assert.Equal("a2", next);
    }

    [Fact]
    public async Task RefreshAsync_DoesNotPersistOnFailure()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.Unauthorized, """{ "reason": "RefreshTokenExpired" }""");
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });
        var wrapper = new RotatingConnectClient(NewClient(handler), store);

        await Assert.ThrowsAsync<ConnectApiException>(() => wrapper.RefreshAsync());

        var stored = await store.LoadAsync();
        Assert.Equal("a1", stored!.AccessToken);
        Assert.Equal("r1", stored.RefreshToken);
    }

    [Fact]
    public async Task LogoutAsync_CallsLogoutAndClearsStore()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.OK, """{ "revoked": true }""");
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });
        var wrapper = new RotatingConnectClient(NewClient(handler), store);

        await wrapper.LogoutAsync();

        Assert.Single(handler.Requests);
        Assert.EndsWith("/logout", handler.Requests[0].RequestUri!.AbsolutePath);
        var sent = JsonDocument.Parse(handler.Requests[0].Body!);
        Assert.Equal("r1", sent.RootElement.GetProperty("refreshToken").GetString());
        Assert.Null(await store.LoadAsync());
    }

    [Fact]
    public async Task LogoutAsync_ClearsStoreEvenWhenLogoutFails()
    {
        var handler = new FakeHttpMessageHandler();
        handler.Enqueue(HttpStatusCode.InternalServerError, """{ "reason": "InternalError" }""");
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });
        var wrapper = new RotatingConnectClient(NewClient(handler), store);

        await Assert.ThrowsAsync<ConnectApiException>(() => wrapper.LogoutAsync());

        Assert.Null(await store.LoadAsync());
    }

    [Fact]
    public async Task LogoutAsync_NoOpWhenStoreEmpty()
    {
        var handler = new FakeHttpMessageHandler();
        var wrapper = new RotatingConnectClient(NewClient(handler), new InMemoryTokenStore());

        await wrapper.LogoutAsync();

        Assert.Empty(handler.Requests);
    }

    [Fact]
    public void Client_ExposesUnderlyingClient()
    {
        var client = NewClient(new FakeHttpMessageHandler());
        var wrapper = new RotatingConnectClient(client, new InMemoryTokenStore());

        Assert.Same(client, wrapper.Client);
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

public class InMemoryTokenStoreTests
{
    [Fact]
    public async Task StartsEmpty()
    {
        var store = new InMemoryTokenStore();

        Assert.Null(await store.LoadAsync());
    }

    [Fact]
    public async Task ReturnsInitialPair()
    {
        var initial = new TokenPair { AccessToken = "a", RefreshToken = "r" };
        var store = new InMemoryTokenStore(initial);

        var loaded = await store.LoadAsync();
        Assert.NotNull(loaded);
        Assert.Equal("a", loaded!.AccessToken);
        Assert.Equal("r", loaded.RefreshToken);
    }

    [Fact]
    public async Task SaveOverwrites()
    {
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a1", RefreshToken = "r1" });

        await store.SaveAsync(new TokenPair { AccessToken = "a2", RefreshToken = "r2" });

        var loaded = await store.LoadAsync();
        Assert.Equal("a2", loaded!.AccessToken);
        Assert.Equal("r2", loaded.RefreshToken);
    }

    [Fact]
    public async Task ClearEmpties()
    {
        var store = new InMemoryTokenStore(new TokenPair { AccessToken = "a", RefreshToken = "r" });

        await store.ClearAsync();

        Assert.Null(await store.LoadAsync());
    }
}
