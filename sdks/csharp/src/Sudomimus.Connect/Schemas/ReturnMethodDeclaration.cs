using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Return-method discriminator values.</summary>
public static class ReturnMethodType
{
    public const string Callback = "CALLBACK";
    public const string StatusPoll = "STATUS_POLL";
    public const string Reveal = "REVEAL";
    public const string DirectIssue = "DIRECT_ISSUE";
    public const string Oidc = "OIDC";
}

/// <summary>
/// Discriminated union on the <c>type</c> property: <c>CALLBACK</c>,
/// <c>STATUS_POLL</c>, <c>REVEAL</c>, <c>DIRECT_ISSUE</c>, or <c>OIDC</c>.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ReturnMethodCallback), "CALLBACK")]
[JsonDerivedType(typeof(ReturnMethodStatusPoll), "STATUS_POLL")]
[JsonDerivedType(typeof(ReturnMethodReveal), "REVEAL")]
[JsonDerivedType(typeof(ReturnMethodDirectIssue), "DIRECT_ISSUE")]
[JsonDerivedType(typeof(ReturnMethodOidc), "OIDC")]
public abstract record ReturnMethodDeclaration;

public sealed record ReturnMethodCallback : ReturnMethodDeclaration
{
    [JsonPropertyName("payload")]
    public required ReturnMethodCallbackPayload Payload { get; init; }
}

public sealed record ReturnMethodCallbackPayload
{
    /// <summary>
    /// Concrete callback URL for this inquiry. Host MUST match one of the
    /// application's allowed callback domains.
    /// </summary>
    [JsonPropertyName("callbackUrl")]
    public required string CallbackUrl { get; init; }
}

public sealed record ReturnMethodStatusPoll : ReturnMethodDeclaration
{
    [JsonPropertyName("payload")]
    public ReturnMethodEmptyPayload Payload { get; init; } = new();
}

public sealed record ReturnMethodReveal : ReturnMethodDeclaration
{
    [JsonPropertyName("payload")]
    public ReturnMethodEmptyPayload Payload { get; init; } = new();
}

/// <summary>
/// Opts the application in to native-api direct-issue flows. Per-inquiry
/// payload is empty because direct-issue does not flow through
/// <c>/establish</c>.
/// </summary>
public sealed record ReturnMethodDirectIssue : ReturnMethodDeclaration
{
    [JsonPropertyName("payload")]
    public ReturnMethodEmptyPayload Payload { get; init; } = new();
}

/// <summary>
/// Accepted on the wire for symmetry. OIDC is in practice not declared
/// per-inquiry — the OIDC API drives its own inquiry against Connect via
/// CALLBACK-to-self, so the per-inquiry payload carries nothing.
/// </summary>
public sealed record ReturnMethodOidc : ReturnMethodDeclaration
{
    [JsonPropertyName("payload")]
    public ReturnMethodEmptyPayload Payload { get; init; } = new();
}

/// <summary>Empty payload shared by STATUS_POLL, REVEAL, DIRECT_ISSUE, and OIDC.</summary>
public sealed record ReturnMethodEmptyPayload;
