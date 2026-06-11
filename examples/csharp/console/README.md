# Sudomimus Connect — C# console example

Plain .NET 8 console app that drives the Sudomimus Native login flow using
the [`Sudomimus.Native`](../../../sdks/csharp/src/Sudomimus.Native) and
[`Sudomimus.Token`](../../../sdks/csharp/src/Sudomimus.Token) SDKs.

The example supports **both Native API direct-issue paths**:

- **`steam-ticket`** — exchange a Steam Web API auth ticket. Used by real
  game clients (see [`examples/csharp/godot/`](../godot) for a Steamworks
  integration via GodotSteam).
- **`access-key`** — exchange a long-lived access-key credential
  (identifier + secret) issued in the admin console. Used by CI, scripts,
  and server-to-server automation.

**No Steam SDK is required to run this example.** Credentials are supplied
as strings on stdin; the example focuses on demonstrating the SDK call
surface, not on integrating Steamworks.

## Prerequisites

1. .NET 8 SDK (or .NET 10 — `RollForward=LatestMajor` is set on the
   example project).
2. A Sudomimus application configured for the method you want to test:
   - **steam-ticket**: `STEAM_TICKET` authentication rule allowing your
     `steamAppId`, plus a `DIRECT_ISSUE` return rule.
   - **access-key**: `ACCESS_KEY_DIRECT` authentication rule, plus a
     `DIRECT_ISSUE` return rule, plus a credential created against the
     account you want to log in as (admin console → application →
     access keys).
3. The credential material:
   - **steam-ticket**: a real Steam ticket hex obtained externally (e.g.
     from the Godot example or any Steamworks-capable program that called
     `ISteamUser::GetAuthTicketForWebApi("sudomimus")`).
   - **access-key**: `accessKeyIdentifier` (UUID v4) and `accessKeySecret`
     (64 hex chars), captured at creation time.
4. (Optional) The application's public PEM key, if you want the example
   to verify the access token signature.

## Run

```bash
dotnet run --project examples/csharp/console
```

You'll be prompted in order:

1. `Auth method:` — type `steam-ticket` or `access-key`.
2. `applicationAnchor:` — the anchor string.
3. (steam-ticket) `steamAppId:` + `steamTicketHex:`.
   (access-key) `accessKeyIdentifier:` + `accessKeySecret:`.
4. (Optional) the application's public PEM key, ended by
   `-----END PUBLIC KEY-----`. Press Enter on the first line to skip.

On success the example prints the decoded access-token user plus the per-claim
view (policy + the user's decision, so you can see why a claim is or isn't in
the token):

```
✓ Login successful.
  subject:           subject-...
  firstName:         <name or SteamID64>
  claims:
    email      requirement=REQUIRED state=GRANTED
    firstName  requirement=OFF      state=UNKNOWN
    lastName   requirement=OFF      state=UNKNOWN
```

## Claim-gated logins (errands)

Login runs through `NativeAuthenticator` in automatic mode. If the application
requires a claim the user hasn't granted (or the account lacks the data — e.g.
a Steam-first account with no email), the Native API returns an **errand**
handoff instead of a bare `403`. The example then:

1. opens the errand URL in your **system browser** (`Process.Start`),
2. prints `[errand] BrowserOpened` / `Polling` progress while you complete it,
3. polls the errand status and **retries** once you finish — so the login
   completes rather than dead-ending.

For the **steam-ticket** method you'll be re-prompted for a *fresh* ticket on
the retry (Steam tickets are single-use). For **access-key** the same credential
is reused automatically.

## Failure modes

| Symptom | Cause |
|---|---|
| `403 Layer1Denied` | The authentication rule rejects this method/appId. |
| `403 Layer2Denied` | The realize rule rejected the resolved identity. |
| `403 Layer3Denied` | No `DIRECT_ISSUE` return rule is configured. |
| `401 SteamTicketInvalid` | Steam rejected the ticket. |
| `401 AccessKeyDirectDenied` | Access key unknown / wrong secret / revoked / expired / wrong application (server deliberately collapses these into one opaque code). |
| `404 ApplicationNotFound` | `applicationAnchor` doesn't match a registered app. |
| `409 ReplayProtectionAlreadySeen` | (steam-ticket only) The ticket was redeemed inside the 24-hour replay window. Acquire a fresh ticket. |
| `502 SteamTicketVerificationFailed` | Steam's verification endpoint was unreachable. |
