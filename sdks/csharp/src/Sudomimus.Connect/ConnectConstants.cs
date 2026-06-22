namespace Sudomimus.Connect;

/// <summary>
/// Constants shared by every Sudomimus Connect API caller. Values mirror
/// <c>@sudomimus/connect</c>; drift here causes interoperability bugs.
/// </summary>
public static class ConnectConstants
{
    /// <summary>Production base URL of the Connect API.</summary>
    public const string ProductionBaseUrl = "https://connect-api.sudomimus.com";

    /// <summary>
    /// Default locale used when fetching application metadata for public-key
    /// resolution. Matches the TS SDK's <c>DEFAULT_PUBLIC_KEY_LOCALE</c>.
    /// </summary>
    public const string DefaultPublicKeyLocale = "en-US";

    /// <summary>
    /// Fixed <c>aud</c> claim value the server requires on Connect client-auth
    /// JWTs (<c>/establish</c>).
    /// </summary>
    public const string ClientJwtAudience = "sudomimus-connect";

    /// <summary>
    /// HTTP <c>Authorization</c> scheme used to carry the client-auth JWT.
    /// </summary>
    public const string ClientJwtAuthScheme = "SudomimusClientJWT";

    /// <summary>Default JWT lifetime (<c>exp - iat</c>) in seconds.</summary>
    public const int ClientJwtDefaultLifetimeSeconds = 30;

    /// <summary>
    /// Maximum JWT lifetime the server accepts. Requests with longer
    /// lifetimes are rejected as <c>S_ClientJwtLifetimeTooLong</c>.
    /// </summary>
    public const int ClientJwtMaxLifetimeSeconds = 60;
}
