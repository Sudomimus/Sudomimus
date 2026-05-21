// Sudomimus Connect — .NET console example.
//
// Interactive CLI that demonstrates the full Native API login flow:
//   1. Read applicationAnchor, steamAppId, and a pre-acquired Steam Web
//      API ticket (hex) from stdin. (In a real game these come from
//      Steamworks; the console example takes them as input so it can run
//      without Steam SDK integration.)
//   2. Optionally read the application's public PEM key for token
//      verification.
//   3. POST /direct-issue/steam-ticket via Sudomimus.Native.
//   4. Parse — and optionally verify — the returned access token via
//      Sudomimus.Token.
//   5. Print the resulting user (accountIdentifier, firstName, lastName?).

using Sudomimus.Native;
using Sudomimus.Token;

const string PemEndLine = "-----END PUBLIC KEY-----";

Console.Write("applicationAnchor: ");
var anchor = (Console.ReadLine() ?? string.Empty).Trim();

Console.Write("steamAppId: ");
if (!long.TryParse(Console.ReadLine(), out var appId) || appId <= 0)
{
    Console.Error.WriteLine("steamAppId must be a positive integer.");
    return 1;
}

Console.Write("steamTicketHex (single line): ");
var ticketHex = (Console.ReadLine() ?? string.Empty).Trim();

Console.WriteLine();
Console.WriteLine("Optional: paste the application's PEM public key to verify");
Console.WriteLine("the access token (end with the literal line");
Console.WriteLine($"\"{PemEndLine}\"), or press Enter to skip verification.");

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

Console.WriteLine();
Console.WriteLine("Calling /direct-issue/steam-ticket ...");

var client = new NativeClient();
DirectIssueSteamTicketResponse response;
try
{
    response = await client.DirectIssueSteamTicketAsync(new DirectIssueSteamTicketRequest
    {
        ApplicationAnchor = anchor,
        SteamTicketHex = ticketHex,
        SteamAppId = appId,
    });
}
catch (NativeApiException ex)
{
    Console.Error.WriteLine($"Native API rejected the request: {(int)ex.StatusCode} {ex.Reason ?? "(no reason)"}");
    return 2;
}

Console.WriteLine("Access token received.");

JwtToken<AccessTokenBody> parsed;
if (publicKeyPem is not null)
{
    var verifier = new TokenVerifier((_, _) => Task.FromResult(publicKeyPem));
    try
    {
        parsed = await verifier.VerifyAccessTokenAsync(response.AccessToken);
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
    parsed = TokenParser.ParseAccessToken(response.AccessToken);
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
