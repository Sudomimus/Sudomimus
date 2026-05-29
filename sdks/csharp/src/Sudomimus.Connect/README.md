# Sudomimus.Connect

C# SDK for the [Sudomimus](https://sudomimus.com) Connect API. Establish
authentication inquiries, poll status, redeem tokens, refresh access
tokens, fetch localized application metadata, introspect sessions, and
revoke them.

Mirrors the [`@sudomimus/connect`](https://www.npmjs.com/package/@sudomimus/connect)
TypeScript SDK and the [`sudomimus-connect`](https://pypi.org/project/sudomimus-connect/)
Python SDK. Generic .NET 8 package — works in console apps, Godot, Unity,
ASP.NET Core, or any .NET host.

## Quick start

```csharp
using Sudomimus.Connect;

var client = new ConnectClient(ConnectConstants.ProductionBaseUrl);

// Unauthenticated endpoints — anything except /establish and /revoke-all.
var info = await client.InfoAsync(new InfoRequest
{
    ApplicationAnchor = "anchor-xxx",
    Locale = "en-US",
});

// Verify a JWT issued by Connect using the application's public key.
var accessToken = await client.VerifyAccessTokenAsync(jwt);
```

## Establish / revoke-all (client-auth)

`/establish` and `/revoke-all` require a short-lived client-auth JWT
signed with the application's registered private key. Provide a
[`ConnectClientAuthWithKey`](./ConnectClientAuth.cs) and the SDK signs
in-process:

```csharp
var client = new ConnectClient(new ConnectClientOptions
{
    BaseUrl = ConnectConstants.ProductionBaseUrl,
    ClientAuth = new ConnectClientAuthWithKey
    {
        ApplicationAnchor = "anchor-xxx",
        PrivateKeyPem = File.ReadAllText("client-auth.pem"),
    },
});

var inquiry = await client.EstablishAsync(new EstablishRequest
{
    ApplicationAnchor = "anchor-xxx",
});
```

To keep the private key out of the SDK (HSM, KMS, sidecar service), use
`ConnectClientAuthWithSigner` and return a fully signed JWT yourself. The
signer receives the exact UTF-8 JSON body that will be sent on the wire;
the `body_sha256` claim must be the standard base64 of `SHA-256(rawBody)`.

```csharp
ClientAuth = new ConnectClientAuthWithSigner
{
    ApplicationAnchor = "anchor-xxx",
    Signer = async (rawBody, ct) => await externalSigner.SignAsync(rawBody, ct),
};
```

## Token storage contract (read this before shipping refresh)

The Connect API does **OAuth 2.1 BCP §4.14.2 strict refresh-token rotation**: every `/refresh` returns a new pair AND invalidates the refresh token you presented. Re-presenting an already-rotated refresh token (or losing the rotation race to a concurrent caller) is treated as evidence of compromise — the server revokes the entire refresh-token family and the user must re-authenticate from scratch.

In practice this means **every successful `/refresh` MUST atomically replace your persisted refresh token** with the new one before any other code can read the old one. The bare `ConnectClient` does not do this for you — it is a stateless HTTP wrapper. Two options:

**Option 1 — use `RotatingConnectClient`** (recommended for most servers):

```csharp
using Sudomimus.Connect;

var connect = new ConnectClient(ConnectConstants.ProductionBaseUrl);

// One store per session. Swap InMemoryTokenStore for a Redis-/DB-backed
// implementation of the ITokenStore interface in production.
var session = new RotatingConnectClient(connect, new InMemoryTokenStore());

await session.SeedAsync(new TokenPair
{
    AccessToken = tokensFromRedeem.AccessToken,
    RefreshToken = tokensFromRedeem.RefreshToken,
});
var access = await session.GetAccessTokenAsync();
var next   = await session.RefreshAsync();   // rotates, persists, returns new access token
await session.LogoutAsync();                  // best-effort /logout + clear store
```

`RotatingConnectClient` also coalesces concurrent `RefreshAsync` calls on the same instance onto a single in-flight `/refresh`, which avoids tripping `RefreshTokenRotationRaceLost` when many requests fire simultaneously. **Cross-process** races still need an external lock (Redis, DB row lock) wrapping `load → /refresh → save`.

**Option 2 — implement the bookkeeping yourself.** If you do, the contract is: between the moment you read the current refresh token and the moment you persist the new pair, no other code path may read the old token. Any partial write (new access stored, new refresh dropped) desynchronises you from the server and the next `/refresh` will trip `RefreshTokenFamilyCompromised`.

## Error handling

Non-2xx responses throw [`ConnectApiException`](./ConnectApiException.cs)
carrying the HTTP status, the server's stable `reason` symbol (when the
body is present — `PRIVATE` reasons emit an empty body), and the parsed
error envelope.

Misconfiguration (e.g. calling `EstablishAsync` without `ClientAuth`)
throws [`ConnectConfigException`](./ConnectConfigException.cs).
