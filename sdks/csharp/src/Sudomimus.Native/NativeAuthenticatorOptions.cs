namespace Sudomimus.Native;

/// <summary>Configuration for <see cref="NativeAuthenticator"/>.</summary>
public sealed record NativeAuthenticatorOptions
{
    /// <summary>
    /// How a URL is opened in the user's browser. Required — the SDK cannot know
    /// the host (Godot <c>OS.ShellOpen</c>, Unity <c>Application.OpenURL</c>,
    /// console <c>Process.Start</c>). Called at the moment the errand browser
    /// side-trip should begin; for a synchronous opener, return
    /// <see cref="Task.CompletedTask"/>.
    /// </summary>
    public required Func<Uri, CancellationToken, Task> OpenUrl { get; init; }

    /// <summary>
    /// How often <see cref="NativeAuthenticator.AuthenticateAsync"/> polls the
    /// errand status. Default 2 seconds.
    /// </summary>
    public TimeSpan PollInterval { get; init; } = TimeSpan.FromSeconds(2);

    /// <summary>
    /// How long <see cref="NativeAuthenticator.AuthenticateAsync"/> keeps polling
    /// before throwing <see cref="ErrandPollTimeoutException"/>. Default 30
    /// minutes (the errand's own lifetime), so polling normally ends when the
    /// server reports the terminal status rather than on this deadline.
    /// </summary>
    public TimeSpan PollTimeout { get; init; } = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Maximum number of errand recoveries attempted before
    /// <see cref="NativeAuthenticator.AuthenticateAsync"/> rethrows the
    /// claim-gate exception. Default 2 (one recovery, plus a re-mint after an
    /// expiry). Each recovery is one browser-open + poll cycle.
    /// </summary>
    public int MaxErrandRounds { get; init; } = 2;

    /// <summary>
    /// Optional progress hook for UI ("waiting for browser…", "finishing
    /// login…").
    /// </summary>
    public IProgress<ErrandProgress>? Progress { get; init; }

    /// <summary>
    /// Clock used for the poll deadline; override in tests. Defaults to the
    /// system UTC clock.
    /// </summary>
    public Func<DateTimeOffset> Clock { get; init; } = () => DateTimeOffset.UtcNow;
}
