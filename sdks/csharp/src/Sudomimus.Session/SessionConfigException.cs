namespace Sudomimus.Session;

/// <summary>
/// Thrown when a <see cref="SessionClient"/> is misconfigured at call time —
/// e.g. invoking <c>RevokeAllAsync</c> without a <c>ClientAuth</c> config,
/// or supplying a JWT lifetime outside the server-accepted bounds.
/// </summary>
public sealed class SessionConfigException : Exception
{
    public SessionConfigException(string message) : base(message)
    {
    }
}
