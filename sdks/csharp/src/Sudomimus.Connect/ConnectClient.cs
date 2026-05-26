using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Sudomimus.Token;

namespace Sudomimus.Connect;

/// <summary>
/// HTTP client for the Sudomimus Connect API. Mirrors the
/// <c>@sudomimus/connect</c> TypeScript SDK.
/// </summary>
public sealed class ConnectClient
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly HttpClient s_defaultHttpClient = new();

    private readonly HttpClient _http;
    private readonly Uri _baseUrl;
    private readonly string _publicKeyLocale;
    private readonly ConnectClientAuth? _clientAuth;
    private readonly ConcurrentDictionary<string, string> _publicKeyCache = new();
    private readonly TokenVerifier _tokenVerifier;
    private readonly Func<DateTimeOffset> _clock;

    /// <summary>
    /// Construct against the given base URL using the process-wide shared
    /// <see cref="HttpClient"/>.
    /// </summary>
    public ConnectClient(string baseUrl = ConnectConstants.ProductionBaseUrl)
        : this(new ConnectClientOptions { BaseUrl = baseUrl })
    {
    }

    public ConnectClient(ConnectClientOptions options)
        : this(options, () => DateTimeOffset.UtcNow)
    {
    }

    /// <summary>Test-friendly overload that lets callers stub "now".</summary>
    internal ConnectClient(ConnectClientOptions options, Func<DateTimeOffset> clock)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrEmpty(options.BaseUrl))
        {
            throw new ArgumentException("BaseUrl must not be null or empty.", nameof(options));
        }

        _baseUrl = new Uri(options.BaseUrl.TrimEnd('/'));
        _http = options.HttpClient ?? s_defaultHttpClient;
        _publicKeyLocale = options.PublicKeyFetchLocale ?? ConnectConstants.DefaultPublicKeyLocale;
        _clientAuth = options.ClientAuth;
        _clock = clock;
        _tokenVerifier = new TokenVerifier(
            (anchor, ct) => GetApplicationPublicKeyAsync(anchor, force: false, ct),
            _clock);
    }

    /// <summary>Base URL the client targets (no trailing slash).</summary>
    public string BaseUrl => _baseUrl.ToString().TrimEnd('/');

    // ───────── Endpoints ─────────

    public Task<HealthResponse> HealthAsync(CancellationToken ct = default)
        => GetAsync<HealthResponse>("/health", ct);

    public Task<EstablishResponse> EstablishAsync(EstablishRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostWithClientAuthAsync<EstablishResponse>(nameof(EstablishAsync), "/establish", request, ct);
    }

    public Task<StatusPollResponse> StatusPollAsync(StatusPollRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<StatusPollRequest, StatusPollResponse>("/status-poll", request, ct);
    }

    public Task<RedeemResponse> RedeemAsync(RedeemRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<RedeemRequest, RedeemResponse>("/redeem", request, ct);
    }

    public Task<RefreshResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<RefreshRequest, RefreshResponse>("/refresh", request, ct);
    }

    public Task<InfoResponse> InfoAsync(InfoRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<InfoRequest, InfoResponse>("/info", request, ct);
    }

    public Task<IntrospectResponse> IntrospectAsync(IntrospectRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<IntrospectRequest, IntrospectResponse>("/introspect", request, ct);
    }

    public Task<LogoutResponse> LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<LogoutRequest, LogoutResponse>("/logout", request, ct);
    }

    public Task<RevokeAllResponse> RevokeAllAsync(RevokeAllRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostWithClientAuthAsync<RevokeAllResponse>(nameof(RevokeAllAsync), "/revoke-all", request, ct);
    }

    // ───────── Public-key resolution ─────────

    /// <summary>
    /// Fetch (and cache) the application's PEM public key by calling
    /// <c>/info</c> under the configured locale.
    /// </summary>
    /// <param name="applicationAnchor">Anchor of the application.</param>
    /// <param name="force">Bypass the in-memory cache for this call.</param>
    /// <param name="cancellationToken">Token observed for cooperative cancellation.</param>
    public async Task<string> GetApplicationPublicKeyAsync(
        string applicationAnchor,
        bool force = false,
        CancellationToken cancellationToken = default)
    {
        if (!force && _publicKeyCache.TryGetValue(applicationAnchor, out var cached))
        {
            return cached;
        }

        var info = await InfoAsync(
            new InfoRequest { ApplicationAnchor = applicationAnchor, Locale = _publicKeyLocale },
            cancellationToken).ConfigureAwait(false);

        _publicKeyCache[applicationAnchor] = info.ApplicationPublicKey;
        return info.ApplicationPublicKey;
    }

    /// <summary>
    /// Drop one or all entries from the public-key cache. Pass
    /// <c>null</c> to clear everything.
    /// </summary>
    public void ClearPublicKeyCache(string? applicationAnchor = null)
    {
        if (applicationAnchor is null)
        {
            _publicKeyCache.Clear();
            return;
        }
        _publicKeyCache.TryRemove(applicationAnchor, out _);
    }

    // ───────── Token verification (forwarded to Sudomimus.Token) ─────────

    public Task<JwtToken<AccessTokenBody>> VerifyAccessTokenAsync(string jwt, CancellationToken ct = default)
        => _tokenVerifier.VerifyAccessTokenAsync(jwt, ct);

    public Task<JwtToken<RefreshTokenBody>> VerifyRefreshTokenAsync(string jwt, CancellationToken ct = default)
        => _tokenVerifier.VerifyRefreshTokenAsync(jwt, ct);

    // ───────── HTTP plumbing ─────────

    private async Task<TResponse> GetAsync<TResponse>(string path, CancellationToken ct)
        where TResponse : class
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(_baseUrl, path));
        request.Headers.Accept.ParseAdd("application/json");
        using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        return await HandleAsync<TResponse>(response, ct).ConfigureAwait(false);
    }

    private async Task<TResponse> PostAsync<TRequest, TResponse>(
        string path,
        TRequest body,
        CancellationToken ct)
        where TRequest : class
        where TResponse : class
    {
        var rawBody = JsonSerializer.Serialize(body, s_jsonOptions);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(_baseUrl, path))
        {
            Content = new StringContent(rawBody, Encoding.UTF8, "application/json"),
        };
        request.Headers.Accept.ParseAdd("application/json");
        using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        return await HandleAsync<TResponse>(response, ct).ConfigureAwait(false);
    }

    private async Task<TResponse> PostWithClientAuthAsync<TResponse>(
        string methodName,
        string path,
        object body,
        CancellationToken ct)
        where TResponse : class
    {
        if (_clientAuth is null)
        {
            throw new ConnectConfigException(
                $"ConnectClient.{methodName}() requires a ClientAuth config. Pass ClientAuth in ConnectClientOptions.");
        }

        // Serialize once. The exact bytes here are what the server hashes
        // against the JWT's body_sha256 claim — re-serializing later would
        // risk drift on key ordering or whitespace.
        var rawBody = JsonSerializer.Serialize(body, body.GetType(), s_jsonOptions);

        var jwt = _clientAuth switch
        {
            ConnectClientAuthWithKey withKey => ClientJwtSigner.Sign(withKey, rawBody, _clock()),
            ConnectClientAuthWithSigner withSigner => await withSigner.Signer(rawBody, ct).ConfigureAwait(false),
            _ => throw new ConnectConfigException(
                $"Unknown ConnectClientAuth subtype: {_clientAuth.GetType().FullName}"),
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(_baseUrl, path))
        {
            Content = new StringContent(rawBody, Encoding.UTF8, "application/json"),
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            ConnectConstants.ClientJwtAuthScheme,
            jwt);

        using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        return await HandleAsync<TResponse>(response, ct).ConfigureAwait(false);
    }

    private static async Task<TResponse> HandleAsync<TResponse>(
        HttpResponseMessage response,
        CancellationToken ct)
        where TResponse : class
    {
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await TryReadErrorBodyAsync(response, ct).ConfigureAwait(false);
            throw new ConnectApiException(response.StatusCode, errorBody?.Reason, errorBody);
        }

        var text = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        var parsed = JsonSerializer.Deserialize<TResponse>(text, s_jsonOptions);

        if (parsed is null)
        {
            throw new ConnectApiException(response.StatusCode, "EmptyResponseBody", null);
        }

        return parsed;
    }

    private static async Task<ConnectErrorBody?> TryReadErrorBodyAsync(
        HttpResponseMessage response,
        CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            if (string.IsNullOrEmpty(text))
            {
                return null;
            }
            return JsonSerializer.Deserialize<ConnectErrorBody>(text, s_jsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
