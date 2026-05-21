// Sudomimus Connect — .NET console example.
//
// Interactive CLI that demonstrates the full Native API login flow via
// either of the two direct-issue methods:
//
//   * steam-ticket — exchange a Steam Web API auth ticket for tokens.
//   * access-key   — exchange a long-lived access-key credential for tokens.
//
// Both paths converge: the example parses the returned access token via
// Sudomimus.Token and prints the resulting user. A real game uses
// steam-ticket; CI / server-to-server / automation uses access-key.

using Sudomimus.Native;
using Sudomimus.Token;

const string PemEndLine = "-----END PUBLIC KEY-----";

Console.Write("Auth method (steam-ticket / access-key): ");
var method = (Console.ReadLine() ?? string.Empty).Trim().ToLowerInvariant();

Console.Write("applicationAnchor: ");
var anchor = (Console.ReadLine() ?? string.Empty).Trim();

var client = new NativeClient();
string accessToken;

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

            Console.Write("steamTicketHex (single line): ");
            var ticketHex = (Console.ReadLine() ?? string.Empty).Trim();

            Console.WriteLine();
            Console.WriteLine("Calling /direct-issue/steam-ticket ...");

            var steamResponse = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
            {
                ApplicationAnchor = anchor,
                SteamTicketHex = ticketHex,
                SteamAppId = appId,
            });
            accessToken = steamResponse.AccessToken;
            break;
        }

        case "access-key":
        case "accesskey":
        {
            Console.Write("accessKeyIdentifier (UUID v4): ");
            var keyId = (Console.ReadLine() ?? string.Empty).Trim();

            Console.Write("accessKeySecret (64 hex chars): ");
            var keySecret = (Console.ReadLine() ?? string.Empty).Trim();

            Console.WriteLine();
            Console.WriteLine("Calling /direct-issue/access-key ...");

            var keyResponse = await client.DirectIssueAccessKeyAsync(new DirectIssueAccessKeyRequest
            {
                ApplicationAnchor = anchor,
                AccessKeyIdentifier = keyId,
                AccessKeySecret = keySecret,
            });
            accessToken = keyResponse.AccessToken;
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
Console.WriteLine($"  accountIdentifier: {parsed.Body.AccountIdentifier}");
Console.WriteLine($"  firstName:         {parsed.Body.FirstName}");
if (!string.IsNullOrEmpty(parsed.Body.LastName))
{
    Console.WriteLine($"  lastName:          {parsed.Body.LastName}");
}

return 0;
