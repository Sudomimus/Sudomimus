using System.Net;

namespace Sudomimus.Native;

/// <summary>
/// Thrown by <see cref="NativeClient"/> when the Native API returns a
/// non-success HTTP status. The <see cref="StatusCode"/> and
/// <see cref="Reason"/> together identify the failure mode.
/// </summary>
public sealed class NativeApiException : Exception
{
    /// <summary>HTTP status code returned by the Native API.</summary>
    public HttpStatusCode StatusCode { get; }

    /// <summary>
    /// Server-emitted stable reason string (e.g. <c>"Layer1Denied"</c>).
    /// <c>null</c> when the response body was empty or unparseable.
    /// </summary>
    public string? Reason { get; }

    /// <summary>
    /// Raw response body, when present and parsed successfully.
    /// </summary>
    public NativeErrorBody? Body { get; }

    public NativeApiException(HttpStatusCode statusCode, string? reason, NativeErrorBody? body)
        : base(reason is null
            ? $"Native API error {(int)statusCode}"
            : $"Native API error {(int)statusCode}: {reason}")
    {
        StatusCode = statusCode;
        Reason = reason;
        Body = body;
    }
}
