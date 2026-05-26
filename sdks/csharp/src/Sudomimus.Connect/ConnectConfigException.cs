namespace Sudomimus.Connect;

/// <summary>
/// Thrown when a <see cref="ConnectClient"/> is misconfigured at call time —
/// e.g. invoking <c>EstablishAsync</c> without a <c>ClientAuth</c> config,
/// or supplying a JWT lifetime outside the server-accepted bounds.
/// </summary>
public sealed class ConnectConfigException : Exception
{
    public ConnectConfigException(string message) : base(message)
    {
    }
}
