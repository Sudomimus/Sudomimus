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
    public async Task<DirectIssueSteamTicketResponse> DirectIssueSteamTicketAsync(
        DirectIssueSteamTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(_baseUrl, "/direct-issue/steam-ticket"))
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
            .ReadFromJsonAsync<DirectIssueSteamTicketResponse>(s_jsonOptions, cancellationToken)
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
