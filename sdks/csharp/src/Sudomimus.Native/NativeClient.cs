using System.Net.Http.Json;
using System.Text.Json;

namespace Sudomimus.Native;

/// <summary>
/// HTTP client for the Sudomimus Native API.
/// </summary>
/// <remarks>
/// The Native API is unauthenticated at the transport layer — the Steam
/// Web API ticket itself is the credential. Pass a hex-encoded ticket from
/// <c>ISteamUser::GetAuthTicketForWebApi("sudomimus")</c> and receive
/// application JWTs.
/// </remarks>
public sealed class NativeClient
{
    /// <summary>
    /// Production base URL of the Native API.
    /// </summary>
    public const string ProductionBaseUrl = "https://native-api.sudomimus.com";

    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Process-wide HttpClient used when the caller does not supply one.
    /// Following .NET guidance, a long-lived shared instance is preferred
    /// over per-call <c>new HttpClient()</c>.
    /// </summary>
    private static readonly HttpClient s_defaultHttpClient = new();

    private readonly HttpClient _http;
    private readonly Uri _baseUrl;

    /// <summary>
    /// Construct a client against the given base URL. Uses a shared
    /// process-wide <see cref="HttpClient"/>. Pass an explicit
    /// <see cref="HttpClient"/> if you need custom handlers, proxies, or
    /// timeouts.
    /// </summary>
    public NativeClient(string baseUrl = ProductionBaseUrl)
        : this(baseUrl, s_defaultHttpClient)
    {
    }

    /// <summary>
    /// Construct a client that uses the supplied <see cref="HttpClient"/>.
    /// The caller retains ownership of the <see cref="HttpClient"/>.
    /// </summary>
    public NativeClient(string baseUrl, HttpClient httpClient)
    {
        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new ArgumentException("baseUrl must not be null or empty.", nameof(baseUrl));
        }

        _baseUrl = new Uri(baseUrl.TrimEnd('/'));
        _http = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
    }

    /// <summary>
    /// The base URL the client targets (no trailing slash).
    /// </summary>
    public string BaseUrl => _baseUrl.ToString().TrimEnd('/');

    /// <summary>
    /// Exchange a Steam Web API auth ticket for application access and
    /// refresh tokens.
    /// </summary>
    /// <exception cref="NativeApiException">
    /// Thrown for any non-2xx response. Inspect
    /// <see cref="NativeApiException.StatusCode"/> and
    /// <see cref="NativeApiException.Reason"/> to distinguish failure modes
    /// (Steam ticket invalid, Layer 1/2/3 denied, replay conflict, etc.).
    /// </exception>
    public Task<DirectIssueSteamTicketResponse> DirectIssueSteamTicketAsync(
        DirectIssueSteamTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostJsonAsync<DirectIssueSteamTicketRequest, DirectIssueSteamTicketResponse>(
            "/direct-issue/steam-ticket",
            request,
            cancellationToken);
    }

    /// <summary>
    /// Exchange an access-key credential (identifier + secret) for
    /// application access and refresh tokens. Access keys are issued in the
    /// admin console against a specific account and are intended for
    /// long-lived headless callers (CI runners, server-to-server scripts,
    /// automation). The secret is a 64-char hex string returned exactly
    /// once at creation time — treat it as a password.
    /// </summary>
    /// <exception cref="NativeApiException">
    /// Thrown for any non-2xx response. All credential-level failures
    /// (unknown identifier, app mismatch, revoked, expired, wrong secret)
    /// collapse into a single opaque <c>AccessKeyDirectDenied</c> 401
    /// reason — distinguish by HTTP status:
    /// <c>400</c>=malformed input, <c>401</c>=credential rejected,
    /// <c>403</c>=Layer 1/2/3 denial, <c>404</c>=unknown application,
    /// <c>500</c>=internal state inconsistency.
    /// </exception>
    public Task<DirectIssueAccessKeyResponse> DirectIssueAccessKeyAsync(
        DirectIssueAccessKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return PostJsonAsync<DirectIssueAccessKeyRequest, DirectIssueAccessKeyResponse>(
            "/direct-issue/access-key",
            request,
            cancellationToken);
    }

    /// <summary>
    /// Poll the status of an errand handed back on a claim-gate 403
    /// (<see cref="NativeApiException.Errand"/>). A pure, side-effect-free read
    /// — safe to call every couple of seconds while the user completes the
    /// browser side-trip. Unknown, malformed, and expired keys all report
    /// <see cref="ErrandStatus.Expired"/> (the endpoint is not a key-validity
    /// oracle). On <see cref="ErrandStatus.Completed"/>, retry the original
    /// direct-issue request once.
    /// </summary>
    /// <exception cref="ArgumentException">
    /// <paramref name="errandKey"/> is null or empty.
    /// </exception>
    /// <exception cref="NativeApiException">
    /// The Native API returned a non-success HTTP status.
    /// </exception>
    public async Task<ErrandStatusResponse> GetErrandStatusAsync(
        string errandKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(errandKey))
        {
            throw new ArgumentException("errandKey must not be null or empty.", nameof(errandKey));
        }

        var path = $"/errand/{Uri.EscapeDataString(errandKey)}/status";
        using var httpRequest = new HttpRequestMessage(HttpMethod.Get, new Uri(_baseUrl, path));
        httpRequest.Headers.Accept.ParseAdd("application/json");

        using var response = await _http.SendAsync(httpRequest, cancellationToken).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await TryReadErrorBodyAsync(response, cancellationToken).ConfigureAwait(false);
            throw new NativeApiException(response.StatusCode, errorBody?.Reason, errorBody);
        }

        var parsed = await response.Content
            .ReadFromJsonAsync<ErrandStatusResponse>(s_jsonOptions, cancellationToken)
            .ConfigureAwait(false);

        if (parsed is null)
        {
            throw new NativeApiException(response.StatusCode, "EmptyResponseBody", null);
        }

        return parsed;
    }

    private async Task<TResponse> PostJsonAsync<TRequest, TResponse>(
        string path,
        TRequest request,
        CancellationToken cancellationToken)
        where TRequest : class
        where TResponse : class
    {
        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(_baseUrl, path))
        {
            Content = JsonContent.Create(request, options: s_jsonOptions),
        };
        httpRequest.Headers.Accept.ParseAdd("application/json");

        using var response = await _http.SendAsync(httpRequest, cancellationToken).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await TryReadErrorBodyAsync(response, cancellationToken).ConfigureAwait(false);
            throw new NativeApiException(response.StatusCode, errorBody?.Reason, errorBody);
        }

        var parsed = await response.Content
            .ReadFromJsonAsync<TResponse>(s_jsonOptions, cancellationToken)
            .ConfigureAwait(false);

        if (parsed is null)
        {
            throw new NativeApiException(response.StatusCode, "EmptyResponseBody", null);
        }

        return parsed;
    }

    private static async Task<NativeErrorBody?> TryReadErrorBodyAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrEmpty(text))
            {
                return null;
            }
            return JsonSerializer.Deserialize<NativeErrorBody>(text, s_jsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
