using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Realize-rule constraint-type discriminator values.</summary>
public static class RealizeConstraintType
{
    public const string Email = "EMAIL";
}

public sealed record RealizeRuleConstraint
{
    /// <summary>One of <see cref="RealizeConstraintType"/>.</summary>
    [JsonPropertyName("constraintType")]
    public required string ConstraintType { get; init; }

    [JsonPropertyName("payload")]
    public required RealizeRuleEmailPayload Payload { get; init; }

    [JsonPropertyName("accessTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? AccessTokenTtlSeconds { get; init; }

    [JsonPropertyName("refreshTokenTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RefreshTokenTtlSeconds { get; init; }
}

public sealed record RealizeRuleEmailPayload
{
    /// <summary>
    /// Email addresses or glob patterns the realized identity must match.
    /// Glob patterns are bounded by server-side limits.
    /// </summary>
    [JsonPropertyName("allowedEmails")]
    public required IReadOnlyList<string> AllowedEmails { get; init; }
}
