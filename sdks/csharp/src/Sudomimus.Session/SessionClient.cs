using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

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
    }

    /// <summary>Base URL the client targets (no trailing slash).</summary>
    public string BaseUrl => _baseUrl.ToString().TrimEnd('/');

    public Task<HealthResponse> HealthAsync(CancellationToken ct = default)
        => GetAsync<HealthResponse>("/health", ct);

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
}
