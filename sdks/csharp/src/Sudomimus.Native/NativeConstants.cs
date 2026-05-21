namespace Sudomimus.Native;

/// <summary>
/// Constants shared by every Sudomimus Native API caller.
/// </summary>
public static class NativeConstants
{
    /// <summary>
    /// The identity string the client SDK MUST pass to
    /// <c>ISteamUser::GetAuthTicketForWebApi(identity)</c>. Steam binds the
    /// issued ticket to this identity, and the Native API's server-side
    /// verifier hardcodes the same value, so tickets generated with any
    /// other identity will be rejected as invalid.
    /// </summary>
    public const string SteamTicketIdentity = "sudomimus";
}
