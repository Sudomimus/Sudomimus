# Sudomimus.Connect

.NET SDK for the Sudomimus Connect API. Connect owns the initial browser
inquiry lifecycle:

- `EstablishAsync`
- `StatusPollAsync`
- `RedeemAsync`
- `InfoAsync`

Use [`Sudomimus.Session`](../Sudomimus.Session) after `RedeemAsync` for
`RefreshAsync`, `IntrospectAsync`, `LogoutAsync`, and `RevokeAllAsync`.

```csharp
using Sudomimus.Connect;

var client = new ConnectClient(new ConnectClientOptions
{
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

`/establish` requires a client-auth JWT with audience `sudomimus-connect`.
Pass `ConnectClientOptions.ClientAuth` to let the SDK sign it, or provide a
BYO signer through `ConnectClientAuthWithSigner`.

`ConnectClient` also exposes `VerifyAccessTokenAsync` and
`VerifyRefreshTokenAsync`, which resolve the application's public key through
`/info` and cache it per client instance. If you only need JWT verification,
depend on `Sudomimus.Token` directly.
