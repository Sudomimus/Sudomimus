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

## Error handling

Non-2xx responses throw [`ConnectApiException`](./ConnectApiException.cs)
carrying the HTTP status, the server's stable `reason` symbol (when the
body is present — `PRIVATE` reasons emit an empty body), and the parsed
error envelope.

Misconfiguration (e.g. calling `EstablishAsync` without `ClientAuth`)
throws [`ConnectConfigException`](./ConnectConfigException.cs).
