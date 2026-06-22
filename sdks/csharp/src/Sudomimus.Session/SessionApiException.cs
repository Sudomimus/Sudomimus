using System.Net;

namespace Sudomimus.Session;

/// <summary>
/// Thrown by <see cref="SessionClient"/> when the Session API returns a
/// non-success HTTP status.
/// </summary>
public sealed class SessionApiException : Exception
{
    /// <summary>HTTP status code returned by the Session API.</summary>
    public HttpStatusCode StatusCode { get; }

    /// <summary>
    /// Server-emitted stable reason string. <c>null</c> when the response
    /// body was empty (PRIVATE reason) or unparseable.
    /// </summary>
    public string? Reason { get; }

    /// <summary>Raw parsed error body, when present.</summary>
    public SessionErrorBody? Body { get; }

    public SessionApiException(HttpStatusCode statusCode, string? reason, SessionErrorBody? body)
        : base(reason is null
            ? $"Session API error {(int)statusCode}"
            : $"Session API error {(int)statusCode}: {reason}")
    {
        StatusCode = statusCode;
        Reason = reason;
        Body = body;
    }
}
