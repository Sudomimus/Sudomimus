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

    /// <summary>
    /// The per-claim view carried on a claim-gate 403, else <c>null</c>.
    /// </summary>
    public ClaimsStateView? Claims => Body?.Claims;

    /// <summary>
    /// The errand browser handoff carried on a claim-gate 403, else <c>null</c>.
    /// Open <see cref="ErrandHandoff.Url"/> in the system browser, poll
    /// <see cref="NativeClient.GetErrandStatusAsync"/> until completion, then
    /// retry the original direct-issue request once.
    /// </summary>
    public ErrandHandoff? Errand => Body?.Errand;

    /// <summary>
    /// True when this is a claim-gate 403 carrying an errand recovery handoff
    /// (<see cref="NativeReason.ClaimConsentRequired"/> /
    /// <see cref="NativeReason.RequiredClaimDataMissing"/> with an
    /// <see cref="Errand"/> present). The recoverable failure mode: walk the
    /// user through <see cref="Errand"/>, then retry.
    /// </summary>
    public bool IsClaimGate =>
        Errand is not null
        && (string.Equals(Reason, NativeReason.ClaimConsentRequired, StringComparison.Ordinal)
            || string.Equals(Reason, NativeReason.RequiredClaimDataMissing, StringComparison.Ordinal));

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
