namespace Sudomimus.Session;

/// <summary>
/// Options for constructing a <see cref="SessionClient"/>. Use the
/// dedicated constructors instead when defaults suffice.
/// </summary>
public sealed record SessionClientOptions
{
    /// <summary>Session API base URL (no trailing slash is required).</summary>
    public string BaseUrl { get; init; } = SessionConstants.ProductionBaseUrl;

    /// <summary>
    /// HTTP client. When unset the process-wide shared instance is used —
    /// matching the guidance for long-lived <see cref="HttpClient"/>.
    /// </summary>
    public HttpClient? HttpClient { get; init; }

    /// <summary>
    /// Client-auth config. Required for <c>RevokeAllAsync</c>; ignored by
    /// every other endpoint.
    /// </summary>
    public SessionClientAuth? ClientAuth { get; init; }
}
