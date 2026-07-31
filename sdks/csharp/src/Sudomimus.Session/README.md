# Sudomimus.Session

.NET SDK for the Sudomimus Session API. Use it after Connect, Device, or Native
has issued an ordinary access/refresh token pair.

The Session `/refresh` endpoint accepts only `APPLICATION` refresh-token
families. OIDC refresh tokens must use the OIDC `/token` endpoint; passing one
here throws `SessionApiException` with status `401` and reason
`RefreshTokenInvalidType`.

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

The client also exposes `ApplicationJwksAsync`,
`ResolveApplicationPublicKeyAsync`, `VerifyAccessTokenAsync`, and
`VerifyRefreshTokenAsync`. JWKS responses honor `Cache-Control: max-age` with
a 5-minute fallback; an unknown `kid` triggers one forced refresh before
`UnknownKeyId` is returned.
