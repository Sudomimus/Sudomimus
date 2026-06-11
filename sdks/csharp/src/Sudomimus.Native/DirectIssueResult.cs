namespace Sudomimus.Native;

/// <summary>
/// A successful direct-issue outcome: the issued tokens plus the per-claim
/// view. Tokens are raw strings (not a <c>Connect.TokenPair</c>) so this
/// package stays dependency-free — seed your <c>RotatingConnectClient</c> from
/// <see cref="AccessToken"/> / <see cref="RefreshToken"/>.
/// </summary>
public sealed record DirectIssueResult
{
    public required string ApplicationAnchor { get; init; }

    /// <summary>Short-lived application access token (JWT).</summary>
    public required string AccessToken { get; init; }

    /// <summary>Long-lived application refresh token (JWT).</summary>
    public required string RefreshToken { get; init; }

    /// <summary>Per-claim view explaining what is or is not in the minted token.</summary>
    public required ClaimsStateView Claims { get; init; }
}
