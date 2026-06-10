namespace Sudomimus.Native;

/// <summary>
/// Wire status of an errand handoff, reported by
/// <see cref="NativeClient.GetErrandStatusAsync"/>. Values match the wire
/// format exactly. One of these appears on
/// <see cref="ErrandStatusResponse.Status"/>.
/// </summary>
public static class ErrandStatus
{
    /// <summary>The ticket exists, is not consumed, and has not expired.</summary>
    public const string Pending = "PENDING";

    /// <summary>Every task finished — retry the original direct-issue request once.</summary>
    public const string Completed = "COMPLETED";

    /// <summary>
    /// The ticket expired, or the key was never valid (the two are deliberately
    /// indistinguishable). A direct-issue retry mints a fresh handoff.
    /// </summary>
    public const string Expired = "EXPIRED";
}
