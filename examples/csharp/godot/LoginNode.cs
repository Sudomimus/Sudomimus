// Sudomimus Connect — Godot example.
//
// Drives the two Sudomimus Native direct-issue flows from a Godot 4 scene:
//
//   * Steam tab        — get a ticket from GodotSteam (identity =
//                        "sudomimus"), POST it to /direct-issue/steam-ticket.
//   * Access Key tab   — exchange a credential (identifier + secret) for
//                        tokens via /direct-issue/access-key. Included so
//                        SDK consumers can exercise the path; production
//                        games should not embed long-lived secrets.
//
// Both paths parse the returned access token with Sudomimus.Token (without
// signature verification — see README), show the resulting user, and seed
// a RotatingSessionClient + InMemoryTokenStore from the returned pair so
// the "Refresh token" and "Logout" buttons can demonstrate the OAuth 2.1
// strict-rotation primitives. A real game would persist the pair to disk
// (encrypted) instead of an InMemoryTokenStore so the player stays logged
// in across launches.

using Godot;
using Sudomimus.Native;
using Sudomimus.Session;
using Sudomimus.Token;

namespace Sudomimus.Examples.Godot;

public partial class LoginNode : Control
{
    // App ID 480 is Steam's public test app (Spacewar). Replace with your
    // real App ID when wiring up against a production Sudomimus app.
    private const long SteamAppId = 480;

    private const string SessionBaseUrl = "https://session-api.sudomimus.com";

    private LineEdit _anchorInput = null!;
    private Button _steamLoginButton = null!;
    private LineEdit _accessKeyIdInput = null!;
    private LineEdit _accessKeySecretInput = null!;
    private Button _accessKeyLoginButton = null!;
    private Label _statusLabel = null!;
    private Label _resultLabel = null!;
    private Button _refreshButton = null!;
    private Button _logoutButton = null!;
    private Node _steam = null!;

    private uint _pendingTicketHandle;
    private RotatingSessionClient? _rotating;

    private NativeClient _native = null!;
    private NativeAuthenticator _authenticator = null!;

    public override void _Ready()
    {
        _anchorInput = GetNode<LineEdit>("VBox/AnchorInput");
        _steamLoginButton = GetNode<Button>("VBox/Tabs/Steam/SteamLoginButton");
        _accessKeyIdInput = GetNode<LineEdit>("VBox/Tabs/AccessKey/AccessKeyIdInput");
        _accessKeySecretInput = GetNode<LineEdit>("VBox/Tabs/AccessKey/AccessKeySecretInput");
        _accessKeyLoginButton = GetNode<Button>("VBox/Tabs/AccessKey/AccessKeyLoginButton");
        _statusLabel = GetNode<Label>("VBox/StatusLabel");
        _resultLabel = GetNode<Label>("VBox/ResultLabel");
        _refreshButton = GetNode<Button>("VBox/SessionButtons/RefreshButton");
        _logoutButton = GetNode<Button>("VBox/SessionButtons/LogoutButton");

        _steam = GetNode("/root/Steam");

        _steamLoginButton.Pressed += OnSteamLoginPressed;
        _accessKeyLoginButton.Pressed += OnAccessKeyLoginPressed;
        _refreshButton.Pressed += OnRefreshPressed;
        _logoutButton.Pressed += OnLogoutPressed;
        _steam.Connect("get_ticket_for_web_api_response", new Callable(this, nameof(OnTicketReady)));

        _native = new NativeClient();
        _authenticator = new NativeAuthenticator(_native, new NativeAuthenticatorOptions
        {
            // Open the errand URL in the player's default browser. OS.ShellOpen
            // is the host-specific opener the SDK deliberately cannot assume.
            OpenUrl = (uri, _) =>
            {
                OS.ShellOpen(uri.ToString());
                return Task.CompletedTask;
            },
            // Progress fires from a background thread (Godot installs no
            // SynchronizationContext), so marshal label updates onto the main
            // thread with SetDeferred.
            Progress = new Progress<ErrandProgress>(p =>
                _statusLabel.SetDeferred("text", ErrandStatusText(p.Phase))),
        });

        // Initialize Steamworks. GodotSteam's `steamInit()` returns a
        // dictionary; for an MVP we trust it and rely on Steam-side
        // failures to surface later.
        _steam.Call("steamInit");
        _statusLabel.Text = "Idle. Pick a tab and log in.";
    }

    // -------- Steam login path -----------------------------------------

    private void OnSteamLoginPressed()
    {
        var anchor = _anchorInput.Text.Trim();
        if (string.IsNullOrEmpty(anchor))
        {
            _statusLabel.Text = "applicationAnchor is required.";
            return;
        }

        _steamLoginButton.Disabled = true;
        _statusLabel.Text = "Requesting Steam ticket...";

        // Identity string MUST equal NativeConstants.SteamTicketIdentity
        // ("sudomimus"). Steam binds the ticket to this identity; passing
        // anything else makes the Native API reject the ticket.
        var result = _steam.Call("getAuthTicketForWebApi", NativeConstants.SteamTicketIdentity);
        _pendingTicketHandle = result.AsUInt32();
    }

    // Signature comes from GodotSteam's get_ticket_for_web_api_response
    // signal: (auth_ticket, result, ticket_size, ticket_buffer_string).
    // Some GodotSteam versions emit the buffer as a hex string already;
    // others as raw bytes. We accept a Variant and normalize.
    private async void OnTicketReady(uint authTicket, int result, uint ticketSize, Variant ticketBuffer)
    {
        if (authTicket != _pendingTicketHandle)
        {
            return; // Some other ticket request — ignore.
        }

        if (result != 1) // 1 == k_EResultOK
        {
            _statusLabel.Text = $"Steam refused to issue a ticket (result={result}).";
            _steamLoginButton.Disabled = false;
            return;
        }

        var ticketHex = NormalizeTicketHex(ticketBuffer);
        _statusLabel.Text = "Calling /direct-issue/steam-ticket...";

        try
        {
            // Manual mode: one attempt with this freshly-acquired ticket. On a
            // claim gate the SDK opens the errand in the browser and hands it
            // back — a Steam ticket is single-use, so the natural retry is for
            // the player to finish in the browser and click Login with Steam
            // again (which acquires a fresh ticket).
            var outcome = await _authenticator.TryAuthenticateSteamTicketAsync(_ => Task.FromResult(
                new DirectIssueSteamTicketRequest
                {
                    ApplicationAnchor = _anchorInput.Text.Trim(),
                    SteamTicketHex = ticketHex,
                    SteamAppId = SteamAppId,
                }));

            switch (outcome)
            {
                case DirectIssueOutcome.Authenticated authenticated:
                    await OnLoginSucceeded(authenticated.Result);
                    break;
                case DirectIssueOutcome.ErrandRequired:
                    _statusLabel.Text = "Finish setup in your browser, then click Login with Steam again.";
                    break;
            }
        }
        catch (NativeApiException ex)
        {
            _statusLabel.Text = $"Native API error: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}";
        }
        finally
        {
            _steam.Call("cancelAuthTicket", _pendingTicketHandle);
            _steamLoginButton.Disabled = false;
        }
    }

    // -------- Access-key login path ------------------------------------

    private async void OnAccessKeyLoginPressed()
    {
        var anchor = _anchorInput.Text.Trim();
        var keyId = _accessKeyIdInput.Text.Trim();
        var keySecret = _accessKeySecretInput.Text.Trim();

        if (string.IsNullOrEmpty(anchor) || string.IsNullOrEmpty(keyId) || string.IsNullOrEmpty(keySecret))
        {
            _statusLabel.Text = "applicationAnchor, accessKeyIdentifier, and accessKeySecret are all required.";
            return;
        }

        _accessKeyLoginButton.Disabled = true;
        _statusLabel.Text = "Calling /direct-issue/access-key...";

        try
        {
            // Automatic mode: an access-key credential is reusable, so the SDK
            // can open the errand in the browser, poll, and retry on its own —
            // the Progress hook drives the status label while the player
            // completes the browser step.
            var login = await _authenticator.AuthenticateAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = anchor,
                AccessKeyIdentifier = keyId,
                AccessKeySecret = keySecret,
            });
            await OnLoginSucceeded(login);
        }
        catch (NativeApiException ex)
        {
            _statusLabel.Text = $"Native API error: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}";
        }
        catch (ErrandPollTimeoutException)
        {
            _statusLabel.Text = "Timed out waiting for browser setup. Try again.";
        }
        finally
        {
            _accessKeyLoginButton.Disabled = false;
        }
    }

    // -------- Refresh / logout -----------------------------------------

    private async void OnRefreshPressed()
    {
        if (_rotating is null)
        {
            return;
        }

        _refreshButton.Disabled = true;
        _logoutButton.Disabled = true;
        _statusLabel.Text = "Calling /refresh...";

        try
        {
            var rotatedAccessToken = await _rotating.RefreshAsync();
            DisplayLoggedInUser(rotatedAccessToken);
            _statusLabel.Text = "✓ Refresh rotated the pair.";
            _refreshButton.Disabled = false;
            _logoutButton.Disabled = false;
        }
        catch (SessionApiException ex)
        {
            // RefreshTokenFamilyCompromised / RefreshTokenRotationRaceLost
            // — the server has revoked the family. Drop the rotating client
            // so the buttons stay disabled until a fresh login.
            _statusLabel.Text = $"Refresh rejected: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"} — please log in again.";
            _resultLabel.Text = "";
            _rotating = null;
        }
    }

    private async void OnLogoutPressed()
    {
        if (_rotating is null)
        {
            return;
        }

        _refreshButton.Disabled = true;
        _logoutButton.Disabled = true;
        _statusLabel.Text = "Calling /logout...";

        try
        {
            await _rotating.LogoutAsync();
            _statusLabel.Text = "✓ Logged out. Refresh token revoked.";
        }
        catch (SessionApiException ex)
        {
            _statusLabel.Text = $"Logout server-side failed ({(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}); store cleared locally.";
        }
        finally
        {
            _resultLabel.Text = "";
            _rotating = null;
        }
    }

    // -------- Shared post-login display --------------------------------

    private async Task OnLoginSucceeded(DirectIssueResult login)
    {
        DisplayLoggedInUser(login.AccessToken, login.Claims);

        // /refresh and /logout do not need clientAuth — the refresh token
        // authorizes both. One SessionClient + RotatingSessionClient per
        // session is the natural shape here.
        var session = new SessionClient(SessionBaseUrl);
        _rotating = new RotatingSessionClient(session, new InMemoryTokenStore());
        await _rotating.SeedAsync(new TokenPair { AccessToken = login.AccessToken, RefreshToken = login.RefreshToken });

        _refreshButton.Disabled = false;
        _logoutButton.Disabled = false;
    }

    // Native and Connect each define a ClaimsStateView (one per service's wire
    // surface) and both namespaces are imported, so the type is qualified.
    private void DisplayLoggedInUser(string accessToken, Sudomimus.Native.ClaimsStateView? claims = null)
    {
        try
        {
            // Demo simplification: decode without verifying the signature.
            // A production game backend that consumes these tokens should
            // verify them with Sudomimus.Token's TokenVerifier.
            var parsed = TokenParser.ParseAccessToken(accessToken);
            _statusLabel.Text = "✓ Login successful.";
            var text =
                $"subject:           {parsed.Body.Subject}\n" +
                $"firstName:         {parsed.Body.FirstName}";
            if (claims is not null)
            {
                text +=
                    $"\nclaims.email:      {claims.Email.Requirement}/{claims.Email.State}" +
                    $"\nclaims.firstName:  {claims.FirstName.Requirement}/{claims.FirstName.State}" +
                    $"\nclaims.lastName:   {claims.LastName.Requirement}/{claims.LastName.State}" +
                    $"\nclaims.avatar:     {claims.Avatar.Requirement}/{claims.Avatar.State}";
            }
            _resultLabel.Text = text;
        }
        catch (TokenException ex)
        {
            _statusLabel.Text = $"Token parse failed: {ex.Code} — {ex.Message}";
        }
    }

    // Friendly status text for each errand recovery phase, shown while the
    // player completes the browser side-trip (automatic mode).
    private static string ErrandStatusText(ErrandPhase phase) => phase switch
    {
        ErrandPhase.Attempting => "Signing in...",
        ErrandPhase.BrowserOpened => "Finish setup in your browser...",
        ErrandPhase.Polling => "Waiting for you to finish in the browser...",
        ErrandPhase.Retrying => "Browser step done — finishing sign-in...",
        ErrandPhase.Expired => "Browser step expired, retrying...",
        ErrandPhase.Succeeded => "✓ Login successful.",
        _ => "Working...",
    };

    /// <summary>
    /// GodotSteam emits the ticket payload differently across releases —
    /// sometimes a hex string, sometimes a PackedByteArray. Normalize to
    /// lowercase hex so the Native API hashes it consistently.
    /// </summary>
    private static string NormalizeTicketHex(Variant ticketBuffer)
    {
        if (ticketBuffer.VariantType == Variant.Type.String)
        {
            return ticketBuffer.AsString().ToLowerInvariant();
        }

        var bytes = ticketBuffer.AsByteArray();
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
