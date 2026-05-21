using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>
/// Request body for <c>POST /direct-issue/access-key</c>.
/// </summary>
public sealed record DirectIssueAccessKeyRequest
{
    [JsonPropertyName("applicationAnchor")]
    public required string ApplicationAnchor { get; init; }

    /// <summary>
    /// UUID v4 identifying the access-key credential (e.g.
    /// <c>01890c5e-1234-4abc-9def-0123456789ab</c>). Issued in the admin
    /// console when the access key is created.
    /// </summary>
    [JsonPropertyName("accessKeyIdentifier")]
    public required string AccessKeyIdentifier { get; init; }

    /// <summary>
    /// 64-char lowercase hex secret (32 random bytes) returned exactly once
    /// when the access key is created. Treat as a long-lived password —
    /// do not log, persist in plaintext beyond the calling process, or
    /// embed in client-distributed binaries.
    /// </summary>
    [JsonPropertyName("accessKeySecret")]
    public required string AccessKeySecret { get; init; }
}
