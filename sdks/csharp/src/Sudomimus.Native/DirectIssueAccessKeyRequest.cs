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
    /// Canonical access-key identifier, including the mandatory
    /// <c>acs_k_</c> prefix followed by its UUID (e.g.
    /// <c>acs_k_01890c5e-1234-4abc-9def-0123456789ab</c>).
    /// Issued in the admin console when the access key is created.
    /// </summary>
    [JsonPropertyName("accessKeyIdentifier")]
    public required string AccessKeyIdentifier { get; init; }

    /// <summary>
    /// Canonical access-key secret, including the mandatory <c>acs_t_</c>
    /// prefix followed by 64 lowercase hex characters (32 random bytes).
    /// Returned exactly once when the access key is created. Treat as a
    /// long-lived password — do not log, persist in plaintext beyond the
    /// calling process, or embed in client-distributed binaries.
    /// </summary>
    [JsonPropertyName("accessKeySecret")]
    public required string AccessKeySecret { get; init; }
}
