using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>Request body for <c>POST /direct-issue/public-key</c>.</summary>
public sealed record DirectIssuePublicKeyRequest
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }
}
