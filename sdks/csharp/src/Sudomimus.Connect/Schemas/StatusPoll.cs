using System.Text.Json.Serialization;

namespace Sudomimus.Connect;

public sealed record StatusPollRequest
{
    [JsonPropertyName("exposureKey")]
    public required string ExposureKey { get; init; }

    [JsonPropertyName("hiddenKey")]
    public required string HiddenKey { get; init; }
}

/// <summary>
/// Discriminated union over <c>status</c>: <c>PENDING</c> or <c>REALIZED</c>.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "status")]
[JsonDerivedType(typeof(StatusPollPendingResponse), "PENDING")]
[JsonDerivedType(typeof(StatusPollRealizedResponse), "REALIZED")]
public abstract record StatusPollResponse;

public sealed record StatusPollPendingResponse : StatusPollResponse;

public sealed record StatusPollRealizedResponse : StatusPollResponse
{
    /// <summary>One-time key proving realization; pass to <c>/redeem</c>.</summary>
    [JsonPropertyName("confirmationKey")]
    public required string ConfirmationKey { get; init; }
}
