namespace Sudomimus.Session;

/// <summary>
/// A pair of Sudomimus application tokens. Initial login flows and
/// <c>/refresh</c> return this shape — persist both verbatim so the next
/// rotation can present the current refresh token.
/// </summary>
public sealed record TokenPair
{
    public required string AccessToken { get; init; }

    public required string RefreshToken { get; init; }
}

/// <summary>
/// Persistence contract for a single Sudomimus session's token pair.
///
/// The Session API does OAuth 2.1 BCP §4.14.2 strict refresh-token
/// rotation: every <c>/refresh</c> returns a NEW refresh token and
/// invalidates the one that was presented. Re-presenting the old
/// refresh token (or losing the rotation race to a concurrent caller)
/// is treated as compromise and revokes the entire refresh-token
/// family.
///
/// Implementations MUST therefore:
/// <list type="number">
///   <item>Return the most recently written pair from <see cref="LoadAsync"/>.</item>
///   <item>Atomically replace the stored pair on <see cref="SaveAsync"/> —
///     partial writes that leave only the new access token without the
///     new refresh token will desynchronize the caller from the server.</item>
///   <item>Be safe to call from multiple concurrent code paths within a
///     single process. Cross-process serialization (e.g. Redis lock
///     around <c>load → /refresh → save</c>) is the caller's responsibility.</item>
/// </list>
///
/// One store instance represents ONE session — typically one logged-in
/// user on one device. For backends that serve many users, instantiate
/// one store per session and back it with whatever per-session storage
/// already exists (database row, Redis hash, distributed cache, …).
/// </summary>
public interface ITokenStore
{
    /// <summary>
    /// Read the current pair. Returns <c>null</c> when no session has
    /// been established yet (or after <see cref="ClearAsync"/>).
    /// </summary>
    Task<TokenPair?> LoadAsync(CancellationToken ct = default);

    /// <summary>
    /// Atomically overwrite the stored pair. Called after the initial login
    /// flow and after every successful <c>/refresh</c>.
    /// </summary>
    Task SaveAsync(TokenPair tokens, CancellationToken ct = default);

    /// <summary>
    /// Forget the pair (e.g. on <c>/logout</c> or family compromise).
    /// </summary>
    Task ClearAsync(CancellationToken ct = default);
}

/// <summary>
/// In-memory single-session token store.
///
/// Suitable for development, tests, and short-lived processes. NOT
/// suitable for a multi-process server — each process holds an
/// independent copy and a refresh-token rotation in one process will
/// not be visible to the others (which will then race and trip family
/// compromise).
/// </summary>
public sealed class InMemoryTokenStore : ITokenStore
{
    private readonly object _gate = new();
    private TokenPair? _pair;

    public InMemoryTokenStore(TokenPair? initial = null)
    {
        _pair = initial;
    }

    public Task<TokenPair?> LoadAsync(CancellationToken ct = default)
    {
        TokenPair? snapshot;
        lock (_gate)
        {
            snapshot = _pair;
        }
        return Task.FromResult(snapshot);
    }

    public Task SaveAsync(TokenPair tokens, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(tokens);
        lock (_gate)
        {
            _pair = new TokenPair
            {
                AccessToken = tokens.AccessToken,
                RefreshToken = tokens.RefreshToken,
            };
        }
        return Task.CompletedTask;
    }

    public Task ClearAsync(CancellationToken ct = default)
    {
        lock (_gate)
        {
            _pair = null;
        }
        return Task.CompletedTask;
    }
}
