using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

/// <summary>Return-method discriminator values.</summary>
public static class ReturnMethodType
{
    public const string Callback = "CALLBACK";
    public const string StatusPoll = "STATUS_POLL";
    public const string Reveal = "REVEAL";
}

/// <summary>
/// Discriminated union on the <c>type</c> property: <c>CALLBACK</c>,
/// <c>STATUS_POLL</c>, or <c>REVEAL</c>.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ReturnMethodCallback), "CALLBACK")]
[JsonDerivedType(typeof(ReturnMethodStatusPoll), "STATUS_POLL")]
[JsonDerivedType(typeof(ReturnMethodReveal), "REVEAL")]
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

/// <summary>Empty payload shared by STATUS_POLL and REVEAL.</summary>
public sealed record ReturnMethodEmptyPayload;
