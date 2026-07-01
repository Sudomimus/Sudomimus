// Sudomimus Connect — .NET console example.
//
// Interactive CLI that demonstrates the full Native API login flow via
// either of the two direct-issue methods:
//
//   * steam-ticket — exchange a Steam Web API auth ticket for tokens.
//   * access-key   — exchange a long-lived access-key credential for tokens.
//
// Login runs through NativeAuthenticator in its automatic (polling) mode: if
// the application requires a claim the user has not granted (or the account
// lacks the data), the Native API returns an errand handoff. The authenticator
// opens that URL in the system browser, polls until the user finishes, and
// retries — so a claim-gated first login completes instead of dead-ending.
//
// Both paths converge: the example prints the per-claim view, parses the
// returned access token via Sudomimus.Token to show the user, then seeds a
// RotatingSessionClient + InMemoryTokenStore from the returned pair and
// demonstrates one /refresh rotation followed by a /logout.
//
// A real game uses steam-ticket; CI / server-to-server / automation uses
// access-key.

using System.Diagnostics;
using Sudomimus.Native;
using Sudomimus.Session;
using Sudomimus.Token;

const string PemEndLine = "-----END PUBLIC KEY-----";
const string SessionBaseUrl = "https://session-api.sudomimus.com";

Console.Write("Auth method (steam-ticket / access-key): ");
var method = (Console.ReadLine() ?? string.Empty).Trim().ToLowerInvariant();

Console.Write("applicationAnchor: ");
var anchor = (Console.ReadLine() ?? string.Empty).Trim();

var nativeClient = new NativeClient();
var authenticator = new NativeAuthenticator(nativeClient, new NativeAuthenticatorOptions
{
    OpenUrl = OpenBrowser,
    Progress = new Progress<ErrandProgress>(p => Console.WriteLine($"  [errand] {p.Phase}")),
});

DirectIssueResult login;
try
{
    switch (method)
    {
        case "steam-ticket":
        case "steam":
        {
            Console.Write("steamAppId: ");
            if (!long.TryParse(Console.ReadLine(), out var appId) || appId <= 0)
            {
                Console.Error.WriteLine("steamAppId must be a positive integer.");
                return 1;
            }

            Console.WriteLine();
            Console.WriteLine("Calling /direct-issue/steam-ticket ...");

            // The factory is invoked once per attempt; an errand retry needs a
            // FRESH ticket, since Steam tickets are single-use and replay-protected.
            var steamAttempt = 0;
            login = await authenticator.AuthenticateSteamTicketAsync(_ =>
            {
                steamAttempt++;
                Console.Write(steamAttempt == 1
                    ? "steamTicketHex (single line): "
                    : "Acquire a FRESH Steam ticket and paste steamTicketHex: ");
                var ticketHex = (Console.ReadLine() ?? string.Empty).Trim();
                return Task.FromResult(new DirectIssueSteamTicketRequest
                {
                    ApplicationAnchor = anchor,
                    SteamTicketHex = ticketHex,
                    SteamAppId = appId,
                });
            });
            break;
        }

        case "access-key":
        case "accesskey":
        {
            Console.Write("accessKeyIdentifier (acs_k_<UUID v4>): ");
            var keyId = (Console.ReadLine() ?? string.Empty).Trim();

            Console.Write("accessKeySecret (acs_t_<64 hex chars>): ");
            var keySecret = (Console.ReadLine() ?? string.Empty).Trim();

            Console.WriteLine();
            Console.WriteLine("Calling /direct-issue/access-key ...");

            login = await authenticator.AuthenticateAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = anchor,
                AccessKeyIdentifier = keyId,
                AccessKeySecret = keySecret,
            });
            break;
        }

        default:
            Console.Error.WriteLine($"Unknown auth method: \"{method}\". Use \"steam-ticket\" or \"access-key\".");
            return 1;
    }
}
catch (NativeApiException ex)
{
    Console.Error.WriteLine($"Native API rejected the request: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}");
    return 2;
}
catch (ErrandPollTimeoutException)
{
    Console.Error.WriteLine("Timed out waiting for the browser errand to complete. Re-run and finish the browser step.");
    return 2;
}

var accessToken = login.AccessToken;
var refreshToken = login.RefreshToken;

Console.WriteLine();
Console.WriteLine("Optional: paste the application's PEM public key to verify");
Console.WriteLine($"the access token (end with the literal line \"{PemEndLine}\"),");
Console.WriteLine("or press Enter to skip verification.");

string? publicKeyPem = null;
var firstLine = Console.ReadLine();
if (!string.IsNullOrEmpty(firstLine))
{
    var pemLines = new List<string> { firstLine };
    while (firstLine!.Trim() != PemEndLine)
    {
        firstLine = Console.ReadLine();
        if (firstLine is null) break;
        pemLines.Add(firstLine);
    }
    publicKeyPem = string.Join('\n', pemLines) + "\n";
}

JwtToken<AccessTokenBody> parsed;
if (publicKeyPem is not null)
{
    var verifier = new TokenVerifier((_, _) => Task.FromResult(publicKeyPem));
    try
    {
        parsed = await verifier.VerifyAccessTokenAsync(accessToken);
        Console.WriteLine("Signature verified.");
    }
    catch (TokenException ex)
    {
        Console.Error.WriteLine($"Token verification failed: {ex.Code} — {ex.Message}");
        return 3;
    }
}
else
{
    parsed = TokenParser.ParseAccessToken(accessToken);
    Console.WriteLine("Signature NOT verified (no public key provided).");
}

Console.WriteLine();
Console.WriteLine("✓ Login successful.");
Console.WriteLine($"  subject:           {parsed.Body.Subject}");
Console.WriteLine($"  firstName:         {parsed.Body.FirstName}");
if (!string.IsNullOrEmpty(parsed.Body.LastName))
{
    Console.WriteLine($"  lastName:          {parsed.Body.LastName}");
}

// The claims view explains why each shareable claim is or is not in the token
// (policy joined with the user's decision) — present even when the claim itself
// is absent from the token body above.
PrintClaims(login.Claims);

// Demonstrate refresh-token rotation. The SessionClient does not need
// clientAuth here — /refresh and /logout authorize themselves with the
// refresh token. InMemoryTokenStore is fine for a short-lived CLI; a
// real game would persist the pair to disk (encrypted) so the user
// stays logged in across launches.
Console.WriteLine();
Console.WriteLine("Seeding RotatingSessionClient and calling /refresh ...");

var sessionClient = new SessionClient(SessionBaseUrl);
var rotating = new RotatingSessionClient(sessionClient, new InMemoryTokenStore());
await rotating.SeedAsync(new TokenPair { AccessToken = accessToken, RefreshToken = refreshToken });

try
{
    var rotatedAccessToken = await rotating.RefreshAsync();
    Console.WriteLine($"✓ Rotated. accessToken changed={!string.Equals(rotatedAccessToken, accessToken, StringComparison.Ordinal)}");
}
catch (SessionApiException ex)
{
    Console.Error.WriteLine($"Refresh failed: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}");
    return 4;
}

Console.WriteLine();
Console.WriteLine("Calling /logout ...");
await rotating.LogoutAsync();
Console.WriteLine("✓ Session revoked, store cleared.");

return 0;

// Fully qualified: both Sudomimus.Native and Sudomimus.Connect define a
// ClaimsStateView (each mirrors its own service's wire surface), and this file
// imports both. The direct-issue result carries the Native one.
static void PrintClaims(Sudomimus.Native.ClaimsStateView claims)
{
    Console.WriteLine("  claims:");
    PrintClaim("email", claims.Email);
    PrintClaim("firstName", claims.FirstName);
    PrintClaim("lastName", claims.LastName);
    PrintClaim("avatar", claims.Avatar);

    static void PrintClaim(string name, Sudomimus.Native.ClaimRequirementStateView claim)
        => Console.WriteLine($"    {name,-10} requirement={claim.Requirement,-18} state={claim.State}");
}

static Task OpenBrowser(Uri uri, CancellationToken cancellationToken)
{
    try
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = uri.ToString(),
            UseShellExecute = true,
        });
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"  Could not open a browser automatically ({ex.Message}). Open this URL manually:");
        Console.Error.WriteLine($"    {uri}");
    }

    return Task.CompletedTask;
}
