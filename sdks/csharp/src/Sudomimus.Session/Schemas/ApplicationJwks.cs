using System.Text.Json.Serialization;

namespace Sudomimus.Session;

public sealed record ApplicationJsonWebKey
{
    [JsonPropertyName("kty")]
    public required string KeyType { get; init; }

    [JsonPropertyName("n")]
    public required string Modulus { get; init; }

    [JsonPropertyName("e")]
    public required string Exponent { get; init; }

    [JsonPropertyName("kid")]
    public required string KeyId { get; init; }

    [JsonPropertyName("use")]
    public required string Use { get; init; }

    [JsonPropertyName("alg")]
    public required string Algorithm { get; init; }
}

public sealed record ApplicationJwksResponse
{
    [JsonPropertyName("keys")]
    public required IReadOnlyList<ApplicationJsonWebKey> Keys { get; init; }
}
