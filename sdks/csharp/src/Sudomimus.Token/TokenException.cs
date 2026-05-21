namespace Sudomimus.Token;

/// <summary>
/// Categorical reason a token failed to parse or verify.
/// </summary>
public enum TokenErrorCode
{
    InvalidJwt,
    WrongKeyType,
    MissingAudience,
    Expired,
    InvalidSignature,
}

/// <summary>
/// Thrown by <see cref="TokenParser"/> and <see cref="TokenVerifier"/> when
/// a token fails to parse or fails verification.
/// </summary>
public sealed class TokenException : Exception
{
    public TokenErrorCode Code { get; }

    public TokenException(TokenErrorCode code, string message)
        : base(message)
    {
        Code = code;
    }
}
