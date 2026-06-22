namespace Sudomimus.Native;

/// <summary>
/// High-level helper that wraps a direct-issue attempt with the errand recovery
/// flow. Two invocation styles, so the caller picks how much the SDK drives:
/// <list type="bullet">
///   <item><b>Automatic</b> — <see cref="AuthenticateAsync(Func{CancellationToken, Task{DirectIssueResult}}, CancellationToken)"/>
///   (and the <c>Authenticate*</c> overloads): on a claim gate it opens the
///   browser, polls the errand status, and retries until tokens are issued.</item>
///   <item><b>Manual</b> — <see cref="TryAuthenticateAsync(Func{CancellationToken, Task{DirectIssueResult}}, CancellationToken)"/>
///   (and the <c>TryAuthenticate*</c> overloads): on a claim gate it opens the
///   browser and hands the errand back; the caller decides when to retry (e.g.
///   an "I'm done" button). No polling.</item>
/// </list>
/// The attempt is a delegate so the same loop serves both direct-issue flows,
/// and so the Steam flow can re-acquire a fresh ticket on every retry. Tokens
/// are returned as raw strings on <see cref="DirectIssueResult"/>; seed your
/// <c>RotatingSessionClient</c> from them.
/// </summary>
public sealed class NativeAuthenticator
{
    private readonly NativeClient _client;
    private readonly NativeAuthenticatorOptions _options;

    public NativeAuthenticator(NativeClient client, NativeAuthenticatorOptions options)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        if (_options.OpenUrl is null)
        {
            throw new ArgumentException(
                "NativeAuthenticatorOptions.OpenUrl must be set.",
                nameof(options));
        }
    }

    // ---- Automatic (polling) mode ----

    /// <summary>
    /// Run <paramref name="attempt"/>, transparently recovering from claim-gate
    /// 403s: open the browser, poll the errand until it completes, then retry.
    /// Bounded by <see cref="NativeAuthenticatorOptions.MaxErrandRounds"/>.
    /// Non-claim-gate failures (Layer denials, account disabled, replay, …) and
    /// <see cref="ErrandPollTimeoutException"/> propagate to the caller.
    /// </summary>
    public async Task<DirectIssueResult> AuthenticateAsync(
        Func<CancellationToken, Task<DirectIssueResult>> attempt,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(attempt);

        var errandRounds = 0;
        while (true)
        {
            Report(ErrandPhase.Attempting);
            try
            {
                DirectIssueResult result = await attempt(cancellationToken).ConfigureAwait(false);
                Report(ErrandPhase.Succeeded, claims: result.Claims);
                return result;
            }
            catch (NativeApiException exception) when (exception.IsClaimGate)
            {
                if (errandRounds >= _options.MaxErrandRounds)
                {
                    throw;
                }
                errandRounds++;

                ErrandHandoff errand = exception.Errand!;
                await OpenBrowserAsync(errand, exception.Claims, cancellationToken).ConfigureAwait(false);

                Report(ErrandPhase.Polling, errand, exception.Claims);
                string status = await PollUntilResolvedAsync(errand, cancellationToken).ConfigureAwait(false);

                Report(
                    status == ErrandStatus.Completed ? ErrandPhase.Retrying : ErrandPhase.Expired,
                    errand,
                    exception.Claims);

                // Loop and re-attempt. Completed -> expected success; Expired ->
                // the re-attempt mints a fresh errand, consuming another round
                // (bounded by the check above).
            }
        }
    }

    /// <summary>Automatic mode for the access-key flow (a single static request).</summary>
    public Task<DirectIssueResult> AuthenticateAccessKeyAsync(
        DirectIssueAccessKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return AuthenticateAsync(AccessKeyAttempt(request), cancellationToken);
    }

    /// <summary>
    /// Automatic mode for the Steam flow. <paramref name="requestFactory"/> is
    /// invoked before every attempt so each retry carries a freshly acquired,
    /// single-use Steam ticket.
    /// </summary>
    public Task<DirectIssueResult> AuthenticateSteamTicketAsync(
        Func<CancellationToken, Task<DirectIssueSteamTicketRequest>> requestFactory,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(requestFactory);
        return AuthenticateAsync(SteamTicketAttempt(requestFactory), cancellationToken);
    }

    // ---- Manual (open-and-return) mode ----

    /// <summary>
    /// Run <paramref name="attempt"/> once. On success returns
    /// <see cref="DirectIssueOutcome.Authenticated"/>. On a claim-gate 403 it
    /// opens the browser and returns <see cref="DirectIssueOutcome.ErrandRequired"/>
    /// without polling — the caller drives its own retry (call again once the
    /// user signals they are done). Non-claim-gate failures propagate.
    /// </summary>
    public async Task<DirectIssueOutcome> TryAuthenticateAsync(
        Func<CancellationToken, Task<DirectIssueResult>> attempt,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(attempt);

        Report(ErrandPhase.Attempting);
        try
        {
            DirectIssueResult result = await attempt(cancellationToken).ConfigureAwait(false);
            Report(ErrandPhase.Succeeded, claims: result.Claims);
            return new DirectIssueOutcome.Authenticated(result);
        }
        catch (NativeApiException exception) when (exception.IsClaimGate)
        {
            ErrandHandoff errand = exception.Errand!;
            await OpenBrowserAsync(errand, exception.Claims, cancellationToken).ConfigureAwait(false);
            return new DirectIssueOutcome.ErrandRequired(errand, exception.Claims!, exception.Reason!);
        }
    }

    /// <summary>Manual mode for the access-key flow (a single static request).</summary>
    public Task<DirectIssueOutcome> TryAuthenticateAccessKeyAsync(
        DirectIssueAccessKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return TryAuthenticateAsync(AccessKeyAttempt(request), cancellationToken);
    }

    /// <summary>
    /// Manual mode for the Steam flow. <paramref name="requestFactory"/> is
    /// invoked for the attempt so the retry carries a freshly acquired ticket.
    /// </summary>
    public Task<DirectIssueOutcome> TryAuthenticateSteamTicketAsync(
        Func<CancellationToken, Task<DirectIssueSteamTicketRequest>> requestFactory,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(requestFactory);
        return TryAuthenticateAsync(SteamTicketAttempt(requestFactory), cancellationToken);
    }

    // ---- internals ----

    private Func<CancellationToken, Task<DirectIssueResult>> AccessKeyAttempt(
        DirectIssueAccessKeyRequest request)
        => async cancellationToken =>
        {
            DirectIssueAccessKeyResponse response =
                await _client.DirectIssueAccessKeyAsync(request, cancellationToken).ConfigureAwait(false);
            return ToResult(response.ApplicationAnchor, response.AccessToken, response.RefreshToken, response.Claims);
        };

    private Func<CancellationToken, Task<DirectIssueResult>> SteamTicketAttempt(
        Func<CancellationToken, Task<DirectIssueSteamTicketRequest>> requestFactory)
        => async cancellationToken =>
        {
            DirectIssueSteamTicketRequest request =
                await requestFactory(cancellationToken).ConfigureAwait(false);
            DirectIssueSteamTicketResponse response =
                await _client.DirectIssueSteamTicketAsync(request, cancellationToken).ConfigureAwait(false);
            return ToResult(response.ApplicationAnchor, response.AccessToken, response.RefreshToken, response.Claims);
        };

    private static DirectIssueResult ToResult(
        string applicationAnchor,
        string accessToken,
        string refreshToken,
        ClaimsStateView claims)
        => new()
        {
            ApplicationAnchor = applicationAnchor,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            Claims = claims,
        };

    private async Task OpenBrowserAsync(
        ErrandHandoff errand,
        ClaimsStateView? claims,
        CancellationToken cancellationToken)
    {
        Report(ErrandPhase.BrowserOpened, errand, claims);
        await _options.OpenUrl(new Uri(errand.Url), cancellationToken).ConfigureAwait(false);
    }

    private async Task<string> PollUntilResolvedAsync(
        ErrandHandoff errand,
        CancellationToken cancellationToken)
    {
        DateTimeOffset deadline = _options.Clock() + _options.PollTimeout;
        while (true)
        {
            ErrandStatusResponse response =
                await _client.GetErrandStatusAsync(errand.ErrandKey, cancellationToken).ConfigureAwait(false);
            if (response.Status == ErrandStatus.Completed || response.Status == ErrandStatus.Expired)
            {
                return response.Status;
            }

            if (_options.Clock() >= deadline)
            {
                throw new ErrandPollTimeoutException(errand);
            }

            await Task.Delay(_options.PollInterval, cancellationToken).ConfigureAwait(false);
        }
    }

    private void Report(
        ErrandPhase phase,
        ErrandHandoff? errand = null,
        ClaimsStateView? claims = null)
        => _options.Progress?.Report(new ErrandProgress
        {
            Phase = phase,
            Errand = errand,
            Claims = claims,
        });
}
