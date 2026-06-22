namespace Sudomimus.Connect;

/// <summary>
/// Options for constructing a <see cref="ConnectClient"/>. Use the
/// dedicated constructors instead when defaults suffice.
/// </summary>
public sealed record ConnectClientOptions
{
    /// <summary>Connect API base URL (no trailing slash is required).</summary>
    public string BaseUrl { get; init; } = ConnectConstants.ProductionBaseUrl;

    /// <summary>
    /// HTTP client. When unset the process-wide shared instance is used —
    /// matching the guidance for long-lived <see cref="HttpClient"/>.
    /// </summary>
    public HttpClient? HttpClient { get; init; }

    /// <summary>
    /// Locale used when fetching application metadata for public-key
    /// resolution. Defaults to
    /// <see cref="ConnectConstants.DefaultPublicKeyLocale"/>.
    /// </summary>
    public string? PublicKeyFetchLocale { get; init; }

    /// <summary>
    /// Client-auth config. Required for <c>EstablishAsync</c>; ignored by
    /// every other endpoint.
    /// </summary>
    public ConnectClientAuth? ClientAuth { get; init; }
}
