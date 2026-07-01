namespace Sudomimus.Native;

/// <summary>
/// The application's policy for a shareable claim, set by the developer.
/// Values match the wire format exactly. One of these appears on
/// <see cref="ClaimRequirementStateView.Requirement"/>.
/// </summary>
public static class ClaimRequirement
{
    /// <summary>The application never requests this claim; it is never minted.</summary>
    public const string Off = "OFF";

    /// <summary>Minted only when the user has granted it; never blocks login.</summary>
    public const string Optional = "OPTIONAL";

    /// <summary>The user must grant it for a non-interactive issue to succeed.</summary>
    public const string Required = "REQUIRED";

    /// <summary>Always emits a generated placeholder and never asks for real data.</summary>
    public const string SyntheticOnly = "SYNTHETIC_ONLY";

    /// <summary>Emits real data when shared, otherwise a generated placeholder.</summary>
    public const string SyntheticFallback = "SYNTHETIC_FALLBACK";
}
