using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Authentication-rule method discriminator values.</summary>
public static class AuthenticationMethod
{
    public const string Passkey = "PASSKEY";
    public const string EmailVerification = "EMAIL_VERIFICATION";
}

/// <summary>
/// Per-inquiry narrowing of the application's authentication-rule layer.
/// The shape of <see cref="Payload"/> is determined by <see cref="Method"/>;
/// for the currently defined methods (PASSKEY, EMAIL_VERIFICATION) the
/// payload is empty.
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
/// Empty payload — both currently defined authentication methods (PASSKEY
/// and EMAIL_VERIFICATION) carry no further parameters. The class exists
/// so the field can be strongly typed and to leave room for future
/// per-method fields without a breaking change.
/// </summary>
public sealed record AuthenticationRulePayload;
