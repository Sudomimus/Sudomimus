using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>
/// Request body for <c>POST /establish</c>. All three narrowing fields are
/// optional. When present, the array MUST be non-empty — the server rejects
/// empty arrays with HTTP 400.
/// </summary>
public sealed record EstablishRequest
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    [JsonPropertyName("authenticationConstraints")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<AuthenticationRuleConstraint>? AuthenticationConstraints { get; init; }

    [JsonPropertyName("realizeConstraints")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<RealizeRuleConstraint>? RealizeConstraints { get; init; }

    [JsonPropertyName("returnMethods")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<ReturnMethodDeclaration>? ReturnMethods { get; init; }
}

public sealed record EstablishResponse
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>Public half of the inquiry key pair; safe to share.</summary>
    [JsonPropertyName("exposureKey")]
    public required string ExposureKey { get; init; }

    /// <summary>Private half of the inquiry key pair; must stay on the originating client.</summary>
    [JsonPropertyName("hiddenKey")]
    public required string HiddenKey { get; init; }
}
