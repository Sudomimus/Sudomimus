namespace Sudomimus.Native;

/// <summary>
/// The user's standing decision for a shareable claim. Values match the wire
/// format exactly. One of these appears on
/// <see cref="ClaimRequirementStateView.State"/>.
/// </summary>
public static class ClaimGrantState
{
    /// <summary>The user has never been asked.</summary>
    public const string Unknown = "UNKNOWN";

    /// <summary>The user agreed; the claim is included when the policy allows.</summary>
    public const string Granted = "GRANTED";

    /// <summary>The user explicitly declined; the claim is withheld and not re-asked.</summary>
    public const string Denied = "DENIED";
}
