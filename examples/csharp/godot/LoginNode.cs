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
// signature verification — see README) and show the resulting user.

using Godot;
using Sudomimus.Native;
using Sudomimus.Token;

namespace Sudomimus.Examples.Godot;

public partial class LoginNode : Control
{
    // App ID 480 is Steam's public test app (Spacewar). Replace with your
    // real App ID when wiring up against a production Sudomimus app.
    private const long SteamAppId = 480;

    private LineEdit _anchorInput = null!;
    private Button _steamLoginButton = null!;
    private LineEdit _accessKeyIdInput = null!;
    private LineEdit _accessKeySecretInput = null!;
    private Button _accessKeyLoginButton = null!;
    private Label _statusLabel = null!;
    private Label _resultLabel = null!;
    private Node _steam = null!;

    private uint _pendingTicketHandle;

    public override void _Ready()
    {
        _anchorInput = GetNode<LineEdit>("VBox/AnchorInput");
        _steamLoginButton = GetNode<Button>("VBox/Tabs/Steam/SteamLoginButton");
        _accessKeyIdInput = GetNode<LineEdit>("VBox/Tabs/AccessKey/AccessKeyIdInput");
        _accessKeySecretInput = GetNode<LineEdit>("VBox/Tabs/AccessKey/AccessKeySecretInput");
        _accessKeyLoginButton = GetNode<Button>("VBox/Tabs/AccessKey/AccessKeyLoginButton");
        _statusLabel = GetNode<Label>("VBox/StatusLabel");
        _resultLabel = GetNode<Label>("VBox/ResultLabel");

        _steam = GetNode("/root/Steam");

        _steamLoginButton.Pressed += OnSteamLoginPressed;
        _accessKeyLoginButton.Pressed += OnAccessKeyLoginPressed;
        _steam.Connect("get_ticket_for_web_api_response", new Callable(this, nameof(OnTicketReady)));

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
            var client = new NativeClient();
            var tokens = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = _anchorInput.Text.Trim(),
                SteamTicketHex = ticketHex,
                SteamAppId = SteamAppId,
            });
            DisplayLoggedInUser(tokens.AccessToken);
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
            var client = new NativeClient();
            var tokens = await client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = anchor,
                AccessKeyIdentifier = keyId,
                AccessKeySecret = keySecret,
            });
            DisplayLoggedInUser(tokens.AccessToken);
        }
        catch (NativeApiException ex)
        {
            _statusLabel.Text = $"Native API error: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}";
        }
        finally
        {
            _accessKeyLoginButton.Disabled = false;
        }
    }

    // -------- Shared post-login display --------------------------------

    private void DisplayLoggedInUser(string accessToken)
    {
        try
        {
            // Demo simplification: decode without verifying the signature.
            // A production game backend that consumes these tokens should
            // verify them with Sudomimus.Token's TokenVerifier.
            var parsed = TokenParser.ParseAccessToken(accessToken);
            _statusLabel.Text = "✓ Login successful.";
            _resultLabel.Text =
                $"accountIdentifier: {parsed.Body.AccountIdentifier}\n" +
                $"firstName:         {parsed.Body.FirstName}";
        }
        catch (TokenException ex)
        {
            _statusLabel.Text = $"Token parse failed: {ex.Code} — {ex.Message}";
        }
    }

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
