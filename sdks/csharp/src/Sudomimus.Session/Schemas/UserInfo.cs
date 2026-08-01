using System.Text.Json.Serialization;

namespace Sudomimus.Session;

public sealed record UserInfoResponse
{
    [JsonPropertyName("sub")]
    public required string Subject { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("email_verified")]
    public bool? EmailVerified { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("given_name")]
    public string? GivenName { get; init; }

    [JsonPropertyName("family_name")]
    public string? FamilyName { get; init; }

    [JsonPropertyName("picture")]
    public string? Picture { get; init; }

    [JsonPropertyName("picture_animated")]
    public string? AnimatedPicture { get; init; }
}

public sealed record UserInfoClaimStateView
{
    [JsonPropertyName("email")]
    public required ClaimRequirementStateView Email { get; init; }

    [JsonPropertyName("given_name")]
    public required ClaimRequirementStateView GivenName { get; init; }

    [JsonPropertyName("family_name")]
    public required ClaimRequirementStateView FamilyName { get; init; }

    [JsonPropertyName("picture")]
    public required ClaimRequirementStateView Picture { get; init; }

    [JsonPropertyName("picture_animated")]
    public required ClaimRequirementStateView AnimatedPicture { get; init; }
}

public sealed record ClaimStateResponse
{
    [JsonPropertyName("sub")]
    public required string Subject { get; init; }

    [JsonPropertyName("claims")]
    public required UserInfoClaimStateView Claims { get; init; }
}
