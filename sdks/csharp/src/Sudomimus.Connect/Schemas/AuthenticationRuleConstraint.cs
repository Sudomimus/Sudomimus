using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Authentication-rule method discriminator values.</summary>
public static class AuthenticationMethod
{
    public const string PasskeyUsernameless = "PASSKEY_USERNAMELESS";
    public const string PasskeyReasoned = "PASSKEY_REASONED";
    public const string EmailVerification = "EMAIL_VERIFICATION";
    public const string SteamTicket = "STEAM_TICKET";
    public const string SteamOpenId = "STEAM_OPENID";
    public const string AccessKeyDirect = "ACCESS_KEY_DIRECT";
    public const string GoogleOAuth = "GOOGLE_OAUTH";
    public const string GitHubOAuth = "GITHUB_OAUTH";
    public const string DiscordOAuth = "DISCORD_OAUTH";
    public const string BattleNetOAuth = "BATTLENET_OAUTH";
    public const string XOAuth = "X_OAUTH";
}

/// <summary>
/// Per-inquiry narrowing of the application's authentication-rule layer.
/// The shape of <see cref="Payload"/> is determined by <see cref="Method"/>.
/// </summary>
public sealed record AuthenticationRuleConstraint
{
    /// <summary>One of <see cref="AuthenticationMethod"/>.</summary>
    [JsonPropertyName("method")]
    public required string Method { get; init; }

    [JsonPropertyName("payload")]
    public required AuthenticationRulePayload Payload { get; init; }

    [JsonPropertyName("accessTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? AccessTokenTtlSeconds { get; init; }

    [JsonPropertyName("refreshTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RefreshTokenTtlSeconds { get; init; }
}

/// <summary>
/// Authentication-rule payload. Method-specific fields are optional and
/// only meaningful for the matching <c>Method</c>:
/// <list type="bullet">
///   <item><c>PASSKEY</c>: <see cref="AllowUsernameless"/></item>
///   <item><c>STEAM_TICKET</c>: <see cref="AllowedSteamAppIds"/></item>
///   <item><c>GITHUB_OAUTH</c>: <see cref="AllowedGitHubOrgs"/></item>
///   <item><c>EMAIL_VERIFICATION</c>, <c>STEAM_OPENID</c>, <c>ACCESS_KEY_DIRECT</c>,
///     <c>GOOGLE_OAUTH</c>, <c>DISCORD_OAUTH</c>, <c>BATTLENET_OAUTH</c>,
///     <c>X_OAUTH</c>: empty payload.</item>
/// </list>
/// </summary>
public sealed record AuthenticationRulePayload
{
    /// <summary>PASSKEY: opt in to discoverable-credential ("usernameless") login.</summary>
    [JsonPropertyName("allowUsernameless")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? AllowUsernameless { get; init; }

    /// <summary>STEAM_TICKET: non-empty list of accepted Steam App IDs.</summary>
    [JsonPropertyName("allowedSteamAppIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<long>? AllowedSteamAppIds { get; init; }

    /// <summary>
    /// GITHUB_OAUTH: case-insensitive list of GitHub org <c>login</c>
    /// values. Empty array means no org gating; non-empty requires
    /// membership in at least one listed org.
    /// </summary>
    [JsonPropertyName("allowedGitHubOrgs")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedGitHubOrgs { get; init; }
}
