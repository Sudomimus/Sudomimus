# Sudomimus Connect — C# console example

Plain .NET 8 console app that drives the full Sudomimus Native login flow
using the [`Sudomimus.Native`](../../../sdks/csharp/src/Sudomimus.Native)
and [`Sudomimus.Token`](../../../sdks/csharp/src/Sudomimus.Token) SDKs.

**No Steam SDK is required to run this example.** The Steam Web API ticket
is supplied as a string on stdin; the example focuses on demonstrating the
SDK call surface, not on integrating Steamworks. See
[`examples/csharp/godot/`](../godot) for a real Steamworks integration via
GodotSteam.

## Prerequisites

1. .NET 8 SDK (or .NET 10 — `RollForward=LatestMajor` is set on the
   example project).
2. A Sudomimus application:
   - `applicationAnchor`
   - `STEAM_TICKET` authentication rule allowing the `steamAppId` you'll
     use
   - `DIRECT_ISSUE` return rule
3. A real Steam Web API auth ticket hex, obtained externally (e.g. from
   the Godot example or any Steamworks-capable program that called
   `ISteamUser::GetAuthTicketForWebApi("sudomimus")`).
4. (Optional) The application's public PEM key, if you want the example
   to verify the access token signature.

## Run

```bash
dotnet run --project examples/csharp/console
```

You'll be prompted for:

1. `applicationAnchor:` — the anchor string.
2. `steamAppId:` — the App ID under which the ticket was generated.
3. `steamTicketHex:` — hex-encoded ticket bytes on a single line.
4. (Optional) the application's public PEM key, ended by
   `-----END PUBLIC KEY-----`. Press Enter on the first line to skip.

On success the example prints the decoded access-token claims:

```
✓ Login successful.
  accountIdentifier: acct-...
  firstName:         <SteamID64 or display name>
```

## Failure modes

The example surfaces these explicitly:

| Symptom | Cause |
|---|---|
| `403 Layer1Denied` | The `STEAM_TICKET` rule rejects this `steamAppId`. |
| `403 Layer2Denied` | The realize rule rejected the resolved Steam identity. |
| `403 Layer3Denied` | No `DIRECT_ISSUE` return rule is configured. |
| `401 SteamTicketInvalid` | Steam rejected the ticket — wrong identity, expired, App ID mismatch, etc. |
| `409 ReplayProtectionAlreadySeen` | This ticket was redeemed inside the 24-hour replay window. Acquire a fresh ticket. |
| `502 SteamTicketVerificationFailed` | Steam's verification endpoint was unreachable. |
