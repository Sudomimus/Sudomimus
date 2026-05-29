using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Realize-rule constraint-type discriminator values.</summary>
public static class RealizeConstraintType
{
    public const string Email = "EMAIL";
    public const string SteamId = "STEAM_ID";
    public const string AccountIdentifier = "ACCOUNT_IDENTIFIER";
}

public sealed record RealizeRuleConstraint
{
    /// <summary>One of <see cref="RealizeConstraintType"/>.</summary>
    [JsonPropertyName("constraintType")]
    public required string ConstraintType { get; init; }

    [JsonPropertyName("payload")]
    public required RealizeRulePayload Payload { get; init; }

    [JsonPropertyName("accessTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? AccessTokenTtlSeconds { get; init; }

    [JsonPropertyName("refreshTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RefreshTokenTtlSeconds { get; init; }
}

/// <summary>
/// Realize-rule payload. Exactly one of the optional fields below is
/// populated, matching the parent constraint's <c>ConstraintType</c>:
/// <list type="bullet">
///   <item><c>EMAIL</c>: <see cref="AllowedEmails"/></item>
///   <item><c>STEAM_ID</c>: <see cref="AllowedSteamIds"/> (decimal SteamID64 strings or the literal <c>"*"</c>)</item>
///   <item><c>ACCOUNT_IDENTIFIER</c>: <see cref="AllowedAccountIdentifiers"/> (no wildcard)</item>
/// </list>
/// </summary>
public sealed record RealizeRulePayload
{
    /// <summary>EMAIL: email addresses or glob patterns the realized identity must match.</summary>
    [JsonPropertyName("allowedEmails")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedEmails { get; init; }

    /// <summary>STEAM_ID: decimal SteamID64 strings, or the literal <c>"*"</c> wildcard.</summary>
    [JsonPropertyName("allowedSteamIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedSteamIds { get; init; }

    /// <summary>
    /// ACCOUNT_IDENTIFIER: exact-match account UUIDs. No wildcard;
    /// matches nothing for fresh sign-ups because the account does not
    /// yet exist.
    /// </summary>
    [JsonPropertyName("allowedAccountIdentifiers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedAccountIdentifiers { get; init; }
}

/// <summary>Back-compat alias for the EMAIL-shaped payload.</summary>
public sealed record RealizeRuleEmailPayload
{
    [JsonPropertyName("allowedEmails")]
    public required IReadOnlyList<string> AllowedEmails { get; init; }
}
