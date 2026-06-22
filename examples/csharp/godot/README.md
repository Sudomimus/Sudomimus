# Sudomimus Connect — Godot 4 C# example

Minimal Godot 4.3+ project that drives both Sudomimus Native direct-issue
login flows from a single scene. Uses [GodotSteam](https://godotsteam.com)
for Steam ticket acquisition and the generic
[`Sudomimus.Native`](../../../sdks/csharp/src/Sudomimus.Native) +
[`Sudomimus.Session`](../../../sdks/csharp/src/Sudomimus.Session) +
[`Sudomimus.Token`](../../../sdks/csharp/src/Sudomimus.Token) packages for
the rest.

The SDKs are **not** Godot-specific — see [`examples/csharp/console`](../console)
for a plain .NET example with the same logical flows.

## Two tabs

| Tab | Flow | When to use |
|---|---|---|
| **Steam** | `POST /direct-issue/steam-ticket` after `GetAuthTicketForWebApi("sudomimus")` via GodotSteam | A real game logging the player in via their Steam account. |
| **Access Key** | `POST /direct-issue/access-key` with an identifier + secret typed into the scene | **Demo only.** Lets you exercise the access-key SDK path without a server-side runner. |

> ⚠️ **Do not ship a Godot game that holds a long-lived access-key
> secret.** Access keys are issued for headless callers (CI, server-side
> automation). This tab exists so SDK consumers can see the end-to-end
> shape; the secret should live on a backend or developer workstation, not
> a player's machine.

## Prerequisites

1. **Godot 4.3+ with C# / .NET support.** Download the ".NET" build from
   <https://godotengine.org/download>.
2. **GodotSteam** GDExtension. Install into `addons/godotsteam/` following
   the [official guide](https://godotsteam.com/getting_started/installation/).
   Confirm the `Steam` autoload is registered (Project → Project Settings →
   Autoload).
3. **Steam client running** in the background (Steam SDK requires it,
   even for the access-key tab — `steamInit` is called in `_Ready`).
4. **A Sudomimus application** configured for the method you want to
   test:
   - **Steam tab**: `STEAM_TICKET` authentication rule allowing **Steam
     App ID 480** (Spacewar, the public Steam test app this example uses
     by default) + `DIRECT_ISSUE` return rule.
   - **Access Key tab**: `ACCESS_KEY_DIRECT` authentication rule +
     `DIRECT_ISSUE` return rule + an access-key credential created in the
     admin console (capture the secret at creation time — it's shown
     exactly once).
5. **.NET 8 SDK** (or .NET 10 — `RollForward=LatestMajor` is on by
   default).

## Configuration to change in your own app

| Where | What |
|---|---|
| `LoginNode.cs` | Replace `SteamAppId = 480` with your real App ID. |
| `steam_appid.txt` | Same App ID. Godot's editor / standalone builds need this file to be present at runtime when Steam is initialized outside of a Steam launch. |
| Your Sudomimus app config | Allow the same App ID in the `STEAM_TICKET` rule and ensure a `DIRECT_ISSUE` return rule exists. For access-key login also enable `ACCESS_KEY_DIRECT` and create a credential. |

## Run

1. Open the project in Godot 4 (.NET build).
2. Build the C# assembly (Editor → "Build" or just press F5).
3. Run the project. The scene shows:
   - An input field for `applicationAnchor`
   - Two tabs: **Steam** (Login with Steam button) and **Access Key**
     (identifier + secret + Login button)
   - Status / result labels

### Steam tab

- Type the anchor → click **Login with Steam**.
- GodotSteam calls `GetAuthTicketForWebApi("sudomimus")` and emits
  `get_ticket_for_web_api_response`.
- The example POSTs the hex ticket + App ID to
  `https://native-api.sudomimus.com/direct-issue/steam-ticket`.
- On success the result label shows `subject` and `firstName`.
- The Steam ticket is canceled (`CancelAuthTicket`).

### Access Key tab

- Type the anchor + your access-key identifier (UUID) + secret (64 hex
  chars) → click **Login with Access Key**.
- The example POSTs the credential to
  `https://native-api.sudomimus.com/direct-issue/access-key`.
- All credential-level failures (unknown identifier, wrong secret,
  revoked, expired, wrong application) collapse into a single
  `401 AccessKeyDirectDenied` — by design, to avoid leaking identifier
  existence.

## Claim-gated logins (errands)

Both tabs run through `NativeAuthenticator`. If the application requires a claim
the player hasn't granted (or the account lacks the data, e.g. a Steam-first
account with no email), the Native API returns an **errand** handoff. The
example opens that URL in the player's browser with `OS.ShellOpen` and the two
tabs differ by what the credential allows:

| Tab | Mode | Behaviour on a claim gate |
|---|---|---|
| **Access Key** | automatic | The reusable credential lets the SDK open the browser, poll, and **retry on its own**. The status label tracks progress (`Finish setup in your browser…`) via the `Progress` hook. |
| **Steam** | manual | A Steam ticket is single-use, so the SDK opens the browser and hands the errand back. The label asks the player to finish in the browser and **click Login with Steam again** (which acquires a fresh ticket). |

On success the result label also shows the per-claim view (policy/state for
`email` / `firstName` / `lastName`). The example seeds a
`RotatingSessionClient` from the issued pair and uses Session `/refresh` for
later access-token rotation.

## Notes

- The `Steam` autoload's `getAuthTicketForWebApi` and the
  `get_ticket_for_web_api_response` signal are the literal GodotSteam
  names — they pass through to the underlying Steamworks SDK.
- The example **does not** verify the access-token signature for brevity.
  A production game backend that consumes these tokens should — use
  `Sudomimus.Token.TokenVerifier` with the application's public PEM key
  (fetch once, cache, share across requests).
- The Steam `identity` string `"sudomimus"` is fixed server-side and is
  re-exported by `Sudomimus.Native.NativeConstants.SteamTicketIdentity`.
  Do not change it.

## Acquiring a key pair for verification

The application's public PEM key is returned by Sudomimus Connect's
`/info` endpoint. For a Godot game's purposes you can hardcode it as a
constant — public keys are safe to embed.
