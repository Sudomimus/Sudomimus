// Sudomimus Connect — Godot example.
//
// Drives a full direct-issue Steam login:
//   1. Click "Login with Steam" → request a Steam Web API ticket from
//      the GodotSteam autoload (identity = "sudomimus").
//   2. When Steam fires get_ticket_for_web_api_response, hand the hex
//      ticket to Sudomimus.Native.
//   3. Parse the returned access token with Sudomimus.Token (signature
//      verification optional — see README).
//   4. Show the logged-in user in the scene.

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
    private Button _loginButton = null!;
    private Label _statusLabel = null!;
    private Label _resultLabel = null!;
    private Node _steam = null!;

    private string _applicationAnchor = string.Empty;
    private uint _pendingTicketHandle;

    public override void _Ready()
    {
        _anchorInput = GetNode<LineEdit>("VBox/AnchorInput");
        _loginButton = GetNode<Button>("VBox/LoginButton");
        _statusLabel = GetNode<Label>("VBox/StatusLabel");
        _resultLabel = GetNode<Label>("VBox/ResultLabel");

        _steam = GetNode("/root/Steam");

        _loginButton.Pressed += OnLoginPressed;
        _steam.Connect("get_ticket_for_web_api_response", new Callable(this, nameof(OnTicketReady)));

        // Initialize Steamworks. GodotSteam's `steamInit()` returns a
        // dictionary; for an MVP we trust it and rely on Steam-side
        // failures to surface later.
        _steam.Call("steamInit");
        _statusLabel.Text = "Idle. Enter applicationAnchor and click Login.";
    }

    private void OnLoginPressed()
    {
        _applicationAnchor = _anchorInput.Text.Trim();
        if (string.IsNullOrEmpty(_applicationAnchor))
        {
            _statusLabel.Text = "applicationAnchor is required.";
            return;
        }

        _loginButton.Disabled = true;
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
            _loginButton.Disabled = false;
            return;
        }

        var ticketHex = NormalizeTicketHex(ticketBuffer);
        _statusLabel.Text = "Calling /direct-issue/steam-ticket...";

        try
        {
            var client = new NativeClient();
            var tokens = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = _applicationAnchor,
                SteamTicketHex = ticketHex,
                SteamAppId = SteamAppId,
            });

            // Demo simplification: decode without verifying the signature.
            // A production game should call TokenVerifier with its app
            // public key (or pass it server-side and validate there).
            var parsed = TokenParser.ParseAccessToken(tokens.AccessToken);

            _statusLabel.Text = "✓ Login successful.";
            _resultLabel.Text =
                $"accountIdentifier: {parsed.Body.AccountIdentifier}\n" +
                $"firstName:         {parsed.Body.FirstName}";
        }
        catch (NativeApiException ex)
        {
            _statusLabel.Text = $"Native API error: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}";
        }
        catch (TokenException ex)
        {
            _statusLabel.Text = $"Token parse failed: {ex.Code} — {ex.Message}";
        }
        finally
        {
            // Tell Steam the ticket is no longer needed.
            _steam.Call("cancelAuthTicket", _pendingTicketHandle);
            _loginButton.Disabled = false;
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
