namespace Sudomimus.Native;

/// <summary>
/// Thrown by <see cref="NativeAuthenticator.AuthenticateAsync"/> when the errand
/// was still pending after <see cref="NativeAuthenticatorOptions.PollTimeout"/>.
/// The errand may still be completable in the browser — switch to manual retry
/// (it is exposed on <see cref="Errand"/>) or call again later.
/// </summary>
public sealed class ErrandPollTimeoutException : Exception
{
    /// <summary>The errand that was being polled when the timeout elapsed.</summary>
    public ErrandHandoff Errand { get; }

    public ErrandPollTimeoutException(ErrandHandoff errand)
        : base("Timed out waiting for the errand to complete.")
    {
        Errand = errand;
    }
}
