# Sudomimus.Token

C# SDK for parsing and verifying Sudomimus access and refresh JWTs.

Mirrors the [`@sudomimus/token`](https://www.npmjs.com/package/@sudomimus/token)
TypeScript SDK. Use it wherever you receive tokens issued by Sudomimus
Connect (`/redeem`, `/refresh`) or Native (`/direct-issue/steam-ticket`) —
typically a game's authoritative backend that validates incoming access
tokens.

```csharp
using Sudomimus.Token;

var verifier = new TokenVerifier(async (applicationAnchor, ct) =>
{
    // Resolve the application's PEM public key. Either fetch from
    // Connect's /info endpoint (cache per anchor), or hard-code it for
    // demo / single-app deployments.
    return MY_APPLICATION_PUBLIC_KEY_PEM;
});

var token = await verifier.VerifyAccessTokenAsync(accessTokenJwt);
Console.WriteLine($"{token.Body.AccountIdentifier} ({token.Body.FirstName})");
```

`Sudomimus.Token` is independent of `Sudomimus.Native` — install whichever
you need.
