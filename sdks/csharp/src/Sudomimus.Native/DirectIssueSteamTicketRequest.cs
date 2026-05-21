using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Request body for <c>POST /direct-issue/steam-ticket</c>.
/// </summary>
public sealed record DirectIssueSteamTicketRequest
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>
    /// Hex-encoded Steam Web API auth ticket bytes returned from
    /// <c>ISteamUser::GetAuthTicketForWebApi("sudomimus")</c>. Case
    /// insensitive — the server lowercases before hashing for replay
    /// protection.
    /// </summary>
    [JsonPropertyName("steamTicketHex")]
    public required string SteamTicketHex { get; init; }

    /// <summary>
    /// Steam App ID under which the ticket was generated. Must be
    /// allow-listed by the application's <c>STEAM_TICKET</c> authentication
    /// rule.
    /// </summary>
    [JsonPropertyName("steamAppId")]
    public required long SteamAppId { get; init; }
}
