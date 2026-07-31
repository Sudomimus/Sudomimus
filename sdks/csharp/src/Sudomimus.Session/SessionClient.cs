using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sudomimus.Token;

namespace Sudomimus.Session;

/// <summary>
/// HTTP client for the Sudomimus Session API.
/// </summary>
public sealed class SessionClient
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly HttpClient s_defaultHttpClient = new();

    private readonly HttpClient _http;
    private readonly Uri _baseUrl;
    private readonly SessionClientAuth? _clientAuth;
    private readonly Func<DateTimeOffset> _clock;
    private readonly ConcurrentDictionary<string, JwksCacheEntry> _jwksCache = new();
    private readonly TokenVerifier _tokenVerifier;

    public SessionClient(string baseUrl = SessionConstants.ProductionBaseUrl)
        : this(new SessionClientOptions { BaseUrl = baseUrl })
    {
    }

    public SessionClient(SessionClientOptions options)
        : this(options, () => DateTimeOffset.UtcNow)
    {
    }

    internal SessionClient(SessionClientOptions options, Func<DateTimeOffset> clock)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrEmpty(options.BaseUrl))
        {
            throw new ArgumentException("BaseUrl must not be null or empty.", nameof(options));
        }

        _baseUrl = new Uri(options.BaseUrl.TrimEnd('/'));
        _http = options.HttpClient ?? s_defaultHttpClient;
        _clientAuth = options.ClientAuth;
        _clock = clock;
        _tokenVerifier = new TokenVerifier(ResolveApplicationPublicKeyAsync, clock);
    }

    /// <summary>Base URL the client targets (no trailing slash).</summary>
    public string BaseUrl => _baseUrl.ToString().TrimEnd('/');

    public Task<HealthResponse> HealthAsync(CancellationToken ct = default)
        => GetAsync<HealthResponse>("/health", ct);

    public async Task<ApplicationJwksResponse> ApplicationJwksAsync(
        string applicationAnchor,
        bool force = false,
        CancellationToken ct = default)
    {
        if (!force
            && _jwksCache.TryGetValue(applicationAnchor, out var cached)
            && cached.ExpiresAt > _clock())
        {
            return cached.Value;
        }

        var encodedAnchor = Uri.EscapeDataString(applicationAnchor);
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri(_baseUrl, $"/applications/{encodedAnchor}/jwks.json"));
        request.Headers.Accept.ParseAdd("application/json");
        using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        var maxAge = response.Headers.CacheControl?.MaxAge
            ?? TimeSpan.FromSeconds(SessionConstants.DefaultJwksCacheSeconds);
        var value = await HandleAsync<ApplicationJwksResponse>(response, ct).ConfigureAwait(false);
        _jwksCache[applicationAnchor] = new JwksCacheEntry(_clock() + maxAge, value);
        return value;
    }

    public void ClearJwksCache(string? applicationAnchor = null)
    {
        if (applicationAnchor is null)
        {
            _jwksCache.Clear();
            return;
        }
        _jwksCache.TryRemove(applicationAnchor, out _);
    }

    public async Task<string> ResolveApplicationPublicKeyAsync(
        string applicationAnchor,
        string keyId,
        CancellationToken ct = default)
    {
        var jwks = await ApplicationJwksAsync(applicationAnchor, false, ct).ConfigureAwait(false);
        var key = jwks.Keys.FirstOrDefault(candidate => candidate.KeyId == keyId);
        if (key is null)
        {
            jwks = await ApplicationJwksAsync(applicationAnchor, true, ct).ConfigureAwait(false);
            key = jwks.Keys.FirstOrDefault(candidate => candidate.KeyId == keyId);
        }
        if (key is null)
        {
            throw new TokenException(
                TokenErrorCode.UnknownKeyId,
                $"No application signing key matches kid \"{keyId}\".");
        }

        using var rsa = RSA.Create();
        rsa.ImportParameters(new RSAParameters
        {
            Modulus = DecodeBase64Url(key.Modulus),
            Exponent = DecodeBase64Url(key.Exponent),
        });
        return rsa.ExportSubjectPublicKeyInfoPem();
    }

    public Task<JwtToken<AccessTokenBody>> VerifyAccessTokenAsync(
        string jwt,
        CancellationToken ct = default)
        => _tokenVerifier.VerifyAccessTokenAsync(jwt, ct);

    public Task<JwtToken<RefreshTokenBody>> VerifyRefreshTokenAsync(
        string jwt,
        CancellationToken ct = default)
        => _tokenVerifier.VerifyRefreshTokenAsync(jwt, ct);

    public Task<RefreshResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostAsync<RefreshRequest, RefreshResponse>("/refresh", request, ct);
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
            throw new SessionConfigException(
                $"SessionClient.{methodName}() requires a ClientAuth config. Pass ClientAuth in SessionClientOptions.");
        }

        var rawBody = JsonSerializer.Serialize(body, body.GetType(), s_jsonOptions);

        var jwt = _clientAuth switch
        {
            SessionClientAuthWithKey withKey => ClientJwtSigner.Sign(withKey, rawBody, _clock()),
            SessionClientAuthWithSigner withSigner => await withSigner.Signer(rawBody, ct).ConfigureAwait(false),
            _ => throw new SessionConfigException(
                $"Unknown SessionClientAuth subtype: {_clientAuth.GetType().FullName}"),
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(_baseUrl, path))
        {
            Content = new StringContent(rawBody, Encoding.UTF8, "application/json"),
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            SessionConstants.ClientJwtAuthScheme,
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
            throw new SessionApiException(response.StatusCode, errorBody?.Reason, errorBody);
        }

        var text = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        var parsed = JsonSerializer.Deserialize<TResponse>(text, s_jsonOptions);

        if (parsed is null)
        {
            throw new SessionApiException(response.StatusCode, "EmptyResponseBody", null);
        }

        return parsed;
    }

    private static async Task<SessionErrorBody?> TryReadErrorBodyAsync(
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
            return JsonSerializer.Deserialize<SessionErrorBody>(text, s_jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static byte[] DecodeBase64Url(string value)
    {
        var translated = value.Replace('-', '+').Replace('_', '/');
        var padded = translated.PadRight(translated.Length + (4 - translated.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    private sealed record JwksCacheEntry(DateTimeOffset ExpiresAt, ApplicationJwksResponse Value);
}
