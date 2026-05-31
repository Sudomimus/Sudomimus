using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Realize-rule constraint-type discriminator values.</summary>
public static class RealizeConstraintType
{
    public const string Email = "EMAIL";
    public const string SteamId = "STEAM_ID";
    public const string AccountAlias = "ACCOUNT_ALIAS";
    public const string SectorSubject = "SECTOR_SUBJECT";
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
///   <item><c>ACCOUNT_ALIAS</c>: <see cref="AllowedAccountAliases"/> (no wildcard)</item>
///   <item><c>SECTOR_SUBJECT</c>: <see cref="AllowedSectorSubjects"/> (no wildcard)</item>
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
    /// ACCOUNT_ALIAS: exact-match account aliases — the user-visible,
    /// application-invisible, rotatable handle. No wildcard; matches
    /// nothing for fresh sign-ups because the account does not yet exist.
    /// Opaque: never parsed or format-validated.
    /// </summary>
    [JsonPropertyName("allowedAccountAliases")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedAccountAliases { get; init; }

    /// <summary>
    /// SECTOR_SUBJECT: exact-match sector subjects (the application-visible
    /// token <c>sub</c>) for the realizing application's sector. No
    /// wildcard. Opaque: never parsed or format-validated.
    /// </summary>
    [JsonPropertyName("allowedSectorSubjects")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? AllowedSectorSubjects { get; init; }
}

/// <summary>Back-compat alias for the EMAIL-shaped payload.</summary>
public sealed record RealizeRuleEmailPayload
{
    [JsonPropertyName("allowedEmails")]
    public required IReadOnlyList<string> AllowedEmails { get; init; }
}
