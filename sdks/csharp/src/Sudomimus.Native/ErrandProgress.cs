namespace Sudomimus.Native;

/// <summary>A progress notification emitted by <see cref="NativeAuthenticator"/>.</summary>
public sealed record ErrandProgress
{
    public required ErrandPhase Phase { get; init; }

    /// <summary>The errand handoff, when the phase relates to one.</summary>
    public ErrandHandoff? Errand { get; init; }

    /// <summary>The per-claim view at this point, when available.</summary>
    public ClaimsStateView? Claims { get; init; }
}
