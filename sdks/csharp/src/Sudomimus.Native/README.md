# Sudomimus.Native

C# SDK for the [Sudomimus](https://sudomimus.com) Native API. Exchanges a
Steam Web API auth ticket for application access and refresh tokens in a
single round trip.

Mirrors the [`@sudomimus/native`](https://www.npmjs.com/package/@sudomimus/native)
TypeScript SDK. Generic .NET 8 package — no Steam SDK, no Godot dependency.
Works in plain console apps, Godot, Unity, ASP.NET Core, or any .NET host.

```csharp
using Sudomimus.Native;

using var http = new HttpClient();
var client = new NativeClient(NativeClient.ProductionBaseUrl, http);

var response = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
{
    ApplicationAnchor = "anchor-xxx",
    SteamTicketHex = ticketHex,    // bytes from ISteamUser::GetAuthTicketForWebApi("sudomimus"), hex-encoded
    SteamAppId = 480,
});

// response.AccessToken / response.RefreshToken — parse with Sudomimus.Token.
```

For tickets to verify, the calling Steam client SDK **must** pass identity
`"sudomimus"` to `GetAuthTicketForWebApi(identity)` — Steam binds the issued
ticket to the identity string and the server hardcodes the same value. See
[`NativeConstants.SteamTicketIdentity`](./NativeConstants.cs).
