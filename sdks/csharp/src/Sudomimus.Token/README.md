# Sudomimus.Token

C# SDK for parsing and verifying Sudomimus access and refresh JWTs.

Mirrors the [`@sudomimus/token`](https://www.npmjs.com/package/@sudomimus/token)
TypeScript SDK. Use it wherever you receive tokens issued by Sudomimus
Connect (`/redeem`), Session (`/refresh`), or Native (`/direct-issue/steam-ticket`) —
typically a game's authoritative backend that validates incoming access
tokens.

```csharp
using Sudomimus.Token;

var verifier = new TokenVerifier(async (applicationAnchor, keyId, ct) =>
{
    // Fetch/cache Session JWKS and return the PEM key matching keyId.
    return await myJwksCache.ResolveAsync(applicationAnchor, keyId, ct);
});

var token = await verifier.VerifyAccessTokenAsync(accessTokenJwt);
Console.WriteLine($"{token.Body.Subject} ({token.Body.SessionId})");
```

`Sudomimus.Token` is independent of `Sudomimus.Native` — install whichever
you need.
