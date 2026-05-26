using System.Net;

namespace Sudomimus.Connect;

/// <summary>
/// Thrown by <see cref="ConnectClient"/> when the Connect API returns a
/// non-success HTTP status.
/// </summary>
public sealed class ConnectApiException : Exception
{
    /// <summary>HTTP status code returned by the Connect API.</summary>
    public HttpStatusCode StatusCode { get; }

    /// <summary>
    /// Server-emitted stable reason string. <c>null</c> when the response
    /// body was empty (PRIVATE reason) or unparseable.
    /// </summary>
    public string? Reason { get; }

    /// <summary>Raw parsed error body, when present.</summary>
    public ConnectErrorBody? Body { get; }

    public ConnectApiException(HttpStatusCode statusCode, string? reason, ConnectErrorBody? body)
        : base(reason is null
            ? $"Connect API error {(int)statusCode}"
            : $"Connect API error {(int)statusCode}: {reason}")
    {
        StatusCode = statusCode;
        Reason = reason;
        Body = body;
    }
}
