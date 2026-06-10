namespace Sudomimus.Native;

/// <summary>
/// Stable machine-readable reason codes the Native API emits in error bodies
/// (the <c>reason</c> field, surfaced as <see cref="NativeApiException.Reason"/>).
/// Values match the wire format exactly. This is a curated subset — only the
/// codes this surface actually returns — exposed as named constants so callers
/// stop hard-coding string literals. The raw string stays available on
/// <see cref="NativeApiException.Reason"/> for any code not listed here.
/// </summary>
public static class NativeReason
{
    // -- Claim gate: these 403s additionally carry a claims view and an errand
    //    handoff (see NativeApiException.IsClaimGate). --

    /// <summary>A required claim's consent is still owed (UNKNOWN or DENIED).</summary>
    public const string ClaimConsentRequired = "ClaimConsentRequired";

    /// <summary>Every required claim is granted, but the account lacks the data.</summary>
    public const string RequiredClaimDataMissing = "RequiredClaimDataMissing";

    // -- Three-layer rule denials (403) --

    public const string Layer1Denied = "Layer1Denied";
    public const string Layer2Denied = "Layer2Denied";
    public const string Layer3Denied = "Layer3Denied";

    // -- Application / account state --

    public const string ApplicationDisabled = "ApplicationDisabled";
    public const string ApplicationNotFound = "ApplicationNotFound";
    public const string AccountDisabled = "AccountDisabled";
    public const string AccountDeleted = "AccountDeleted";

    // -- Steam credential (steam-ticket flow) --

    public const string InvalidSteamAppId = "InvalidSteamAppId";
    public const string SteamTicketInvalid = "SteamTicketInvalid";
    public const string SteamTicketVerificationFailed = "SteamTicketVerificationFailed";
    public const string ReplayProtectionAlreadySeen = "ReplayProtectionAlreadySeen";

    // -- Access-key credential (access-key flow) --

    public const string InvalidAccessKeyIdentifier = "InvalidAccessKeyIdentifier";
    public const string InvalidAccessKeySecret = "InvalidAccessKeySecret";
    public const string AccessKeyDirectDenied = "AccessKeyDirectDenied";
}
