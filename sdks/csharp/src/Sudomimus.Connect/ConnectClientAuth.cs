namespace Sudomimus.Connect;

/// <summary>
/// Signature for a BYO (bring-your-own) client-auth JWT signer. Receives
/// the exact JSON string that will be sent on the wire and MUST return a
/// signed JWT whose <c>body_sha256</c> claim is the standard base64 of
/// <c>SHA-256(rawBody)</c> over UTF-8 bytes.
/// </summary>
public delegate Task<string> ConnectClientAuthSigner(string rawBody, CancellationToken cancellationToken);

/// <summary>
/// Configuration for the client-auth JWT required by <c>/establish</c>. Use a derived type:
/// <see cref="ConnectClientAuthWithKey"/> to let the SDK sign with a
/// PEM-encoded RSA private key, or <see cref="ConnectClientAuthWithSigner"/>
/// to delegate signing to an external system (HSM, KMS, etc.).
/// </summary>
public abstract record ConnectClientAuth
{
    /// <summary>Application anchor — embedded as the JWT <c>iss</c> claim.</summary>
    public required string ApplicationAnchor { get; init; }
}

/// <summary>
/// Sign the client-auth JWT locally with a PEM-encoded RS256 private key
/// paired with the application's registered client-auth public key.
/// </summary>
public sealed record ConnectClientAuthWithKey : ConnectClientAuth
{
    /// <summary>PEM-encoded RSA private key (PKCS#1 or PKCS#8).</summary>
    public required string PrivateKeyPem { get; init; }

    /// <summary>
    /// JWT lifetime in seconds (<c>exp - iat</c>). Defaults to
    /// <see cref="ConnectConstants.ClientJwtDefaultLifetimeSeconds"/>. The
    /// server rejects lifetimes above
    /// <see cref="ConnectConstants.ClientJwtMaxLifetimeSeconds"/>.
    /// </summary>
    public int? LifetimeSeconds { get; init; }

    /// <summary>
    /// Override the JWT <c>jti</c> generator. Defaults to
    /// <c>Guid.NewGuid().ToString()</c>. Each call MUST produce a fresh
    /// value — the server enforces single-use replay protection.
    /// </summary>
    public Func<string>? JtiGenerator { get; init; }
}

/// <summary>
/// Delegate JWT signing to an external signer. The SDK never sees the
/// private key.
/// </summary>
public sealed record ConnectClientAuthWithSigner : ConnectClientAuth
{
    public required ConnectClientAuthSigner Signer { get; init; }
}
