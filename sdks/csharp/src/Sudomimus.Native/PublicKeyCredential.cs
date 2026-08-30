namespace Sudomimus.Native;

/// <summary>Signs a JOSE signing input with a registered Ed25519 private key.</summary>
public delegate ValueTask<byte[]> PublicKeySigner(
    ReadOnlyMemory<byte> signingInput,
    CancellationToken cancellationToken);

/// <summary>Registered public-key identifier and its Ed25519 signer.</summary>
public sealed record PublicKeyCredential
{
    /// <summary>Registered identifier in canonical <c>pky_...</c> form.</summary>
    public required string KeyId { get; init; }

    /// <summary>Returns the raw 64-byte Ed25519 signature.</summary>
    public required PublicKeySigner SignAsync { get; init; }
}
