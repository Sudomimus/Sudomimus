# Sudomimus.Session

.NET SDK for the Sudomimus Session API. Use it after Connect, Device, or Native
has issued an ordinary access/refresh token pair.

```csharp
using Sudomimus.Session;

var session = new RotatingSessionClient(
    new SessionClient(),
    new InMemoryTokenStore());

await session.SeedAsync(new TokenPair
{
    AccessToken = accessToken,
    RefreshToken = refreshToken,
});

var newAccessToken = await session.RefreshAsync();
await session.LogoutAsync();
```

`RevokeAllAsync` requires a client-auth JWT with audience
`sudomimus-session`; configure `SessionClientOptions.ClientAuth` to let the SDK
sign it.
