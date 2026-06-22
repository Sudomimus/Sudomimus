namespace Sudomimus.Session;

/// <summary>
/// Wraps a <see cref="SessionClient"/> together with an
/// <see cref="ITokenStore"/> to handle OAuth 2.1 BCP §4.14.2 strict
/// refresh-token rotation correctly:
/// <list type="bullet">
///   <item><see cref="RefreshAsync"/> reads the current refresh token
///     from the store, calls <c>/refresh</c>, and atomically writes the
///     rotated pair back before returning. Callers never see an
///     intermediate state where the old refresh token has been consumed
///     but the new one is not yet persisted.</item>
///   <item>Concurrent <see cref="RefreshAsync"/> calls on the SAME
///     wrapper instance coalesce onto a single in-flight <c>/refresh</c>
///     (in-process de-dupe). This avoids tripping
///     <c>RefreshTokenRotationRaceLost</c> when many requests fire at
///     once and the access token has just expired. Cross-PROCESS races
///     are still the caller's responsibility — back the
///     <see cref="ITokenStore"/> with an external lock (Redis, DB row
///     lock, …) if you run multiple instances.</item>
///   <item><see cref="LogoutAsync"/> best-effort revokes the session
///     server-side and clears the local store, in that order.</item>
/// </list>
///
/// Initial population of the store happens via <see cref="SeedAsync"/>
/// — call it with the <c>{ AccessToken, RefreshToken }</c> pair
/// returned by an ordinary login flow.
/// </summary>
public sealed class RotatingSessionClient
{
    private readonly SessionClient _client;
    private readonly ITokenStore _store;
    private readonly SemaphoreSlim _refreshGate = new(1, 1);
    private Task<string>? _inFlightRefresh;

    public RotatingSessionClient(SessionClient client, ITokenStore store)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _store = store ?? throw new ArgumentNullException(nameof(store));
    }

    /// <summary>
    /// The underlying low-level client. Exposed for callers that need
    /// to drive non-rotation endpoints (<c>/introspect</c>,
    /// <c>/revoke-all</c>, <c>/health</c>) without re-wiring.
    /// </summary>
    public SessionClient Client => _client;

    /// <summary>The token store this wrapper owns.</summary>
    public ITokenStore Store => _store;

    /// <summary>
    /// Persist the initial pair returned by an ordinary login flow. Call this
    /// once, right after a successful redeem, before any other method
    /// on this wrapper.
    /// </summary>
    public Task SeedAsync(TokenPair tokens, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(tokens);
        return _store.SaveAsync(
            new TokenPair { AccessToken = tokens.AccessToken, RefreshToken = tokens.RefreshToken },
            ct);
    }

    /// <summary>
    /// Read the currently-persisted access token. Returns <c>null</c>
    /// when no session is loaded (no <see cref="SeedAsync"/> yet, or
    /// <see cref="LogoutAsync"/> cleared it). Does NOT auto-refresh —
    /// the caller decides when to rotate (typically on a 401 from the
    /// upstream API, or when about to make a long-running call).
    /// </summary>
    public async Task<string?> GetAccessTokenAsync(CancellationToken ct = default)
    {
        var pair = await _store.LoadAsync(ct).ConfigureAwait(false);
        return pair?.AccessToken;
    }

    /// <summary>
    /// Read the currently-persisted token pair. Returns <c>null</c>
    /// when no session is loaded.
    /// </summary>
    public Task<TokenPair?> GetTokensAsync(CancellationToken ct = default)
    {
        return _store.LoadAsync(ct);
    }

    /// <summary>
    /// Rotate the refresh token. Reads the current pair from the
    /// store, calls <c>/refresh</c>, persists the new pair, and
    /// returns the new access token.
    ///
    /// Throws <see cref="SessionConfigException"/> if the store is
    /// empty. Surfaces the underlying <see cref="SessionApiException"/>
    /// (with reasons like <c>RefreshTokenFamilyCompromised</c> /
    /// <c>RefreshTokenRotationRaceLost</c>) on rotation failure — in
    /// those cases the family is server-side revoked and the caller
    /// MUST re-authenticate via Connect, Device, Native, or another ordinary
    /// application-token issuance path.
    ///
    /// Concurrent calls on the same instance share one in-flight
    /// refresh.
    /// </summary>
    public Task<string> RefreshAsync(CancellationToken ct = default)
    {
        Task<string> task;
        lock (_refreshGate)
        {
            if (_inFlightRefresh is { } existing)
            {
                return existing;
            }
            task = PerformRefreshAsync(ct);
            _inFlightRefresh = task;
        }

        return AwaitAndReleaseAsync(task);
    }

    private async Task<string> AwaitAndReleaseAsync(Task<string> task)
    {
        try
        {
            return await task.ConfigureAwait(false);
        }
        finally
        {
            lock (_refreshGate)
            {
                if (ReferenceEquals(_inFlightRefresh, task))
                {
                    _inFlightRefresh = null;
                }
            }
        }
    }

    /// <summary>
    /// Best-effort revoke the session on the server (<c>/logout</c>)
    /// and clear the local store. Idempotent: if the store is empty
    /// this is a no-op. If the server-side revoke fails the local
    /// store is still cleared.
    /// </summary>
    public async Task LogoutAsync(CancellationToken ct = default)
    {
        var pair = await _store.LoadAsync(ct).ConfigureAwait(false);
        if (pair is null)
        {
            return;
        }

        try
        {
            await _client.LogoutAsync(
                new LogoutRequest { RefreshToken = pair.RefreshToken },
                ct).ConfigureAwait(false);
        }
        finally
        {
            await _store.ClearAsync(ct).ConfigureAwait(false);
        }
    }

    private async Task<string> PerformRefreshAsync(CancellationToken ct)
    {
        // Yield once so the in-flight slot held by the caller survives at
        // least one continuation. Without this, an entirely synchronous
        // store + transport (in-memory store with a completed fake HTTP
        // response) would complete the work and clear the slot before any
        // concurrent caller had a chance to attach, defeating coalescing.
        await Task.Yield();

        var pair = await _store.LoadAsync(ct).ConfigureAwait(false);
        if (pair is null)
        {
            throw new SessionConfigException(
                "RotatingSessionClient.RefreshAsync called before SeedAsync — no token pair to rotate.");
        }

        var response = await _client.RefreshAsync(
            new RefreshRequest { RefreshToken = pair.RefreshToken },
            ct).ConfigureAwait(false);

        await _store.SaveAsync(
            new TokenPair
            {
                AccessToken = response.AccessToken,
                RefreshToken = response.RefreshToken,
            },
            ct).ConfigureAwait(false);
        return response.AccessToken;
    }
}
