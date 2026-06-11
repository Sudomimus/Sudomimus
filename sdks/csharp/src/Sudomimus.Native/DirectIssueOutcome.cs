namespace Sudomimus.Native;

/// <summary>
/// Result of a manual-mode attempt
/// (<see cref="NativeAuthenticator.TryAuthenticateAsync"/>): either
/// authenticated, or a claim gate whose browser handoff has already been opened
/// and is handed back for the caller to drive its own retry. The closed
/// hierarchy is exactly <see cref="Authenticated"/> or <see cref="ErrandRequired"/>.
/// </summary>
public abstract record DirectIssueOutcome
{
    private DirectIssueOutcome()
    {
    }

    /// <summary>The attempt succeeded; tokens are in <see cref="Result"/>.</summary>
    public sealed record Authenticated(DirectIssueResult Result) : DirectIssueOutcome;

    /// <summary>
    /// A required claim is unsatisfied. The browser has been opened at
    /// <see cref="ErrandHandoff.Url"/>; once the user finishes, retry by calling
    /// the same <c>TryAuthenticate…</c> method again.
    /// </summary>
    public sealed record ErrandRequired(ErrandHandoff Errand, ClaimsStateView Claims, string Reason) : DirectIssueOutcome;
}
