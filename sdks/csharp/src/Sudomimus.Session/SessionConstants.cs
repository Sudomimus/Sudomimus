namespace Sudomimus.Session;

/// <summary>
/// Constants shared by every Sudomimus Session API caller.
/// </summary>
public static class SessionConstants
{
    /// <summary>Production base URL of the Session API.</summary>
    public const string ProductionBaseUrl = "https://session-api.sudomimus.com";

    /// <summary>
    /// Fixed <c>aud</c> claim value the server requires on client-auth JWTs
    /// for Session API application-authority endpoints.
    /// </summary>
    public const string ClientJwtAudience = "sudomimus-session";

    /// <summary>
    /// HTTP <c>Authorization</c> scheme used to carry the client-auth JWT.
    /// </summary>
    public const string ClientJwtAuthScheme = "SudomimusClientJWT";

    /// <summary>Default JWT lifetime (<c>exp - iat</c>) in seconds.</summary>
    public const int ClientJwtDefaultLifetimeSeconds = 30;

    /// <summary>Maximum JWT lifetime the server accepts.</summary>
    public const int ClientJwtMaxLifetimeSeconds = 60;
}
