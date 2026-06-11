namespace Sudomimus.Native;

/// <summary>Progress phases reported by <see cref="NativeAuthenticator"/>.</summary>
public enum ErrandPhase
{
    /// <summary>About to run (or retry) a direct-issue attempt.</summary>
    Attempting,

    /// <summary>A claim gate was hit; the errand URL was opened in the browser.</summary>
    BrowserOpened,

    /// <summary>Polling the errand status, waiting for the user to finish.</summary>
    Polling,

    /// <summary>The errand completed; about to retry the direct-issue attempt.</summary>
    Retrying,

    /// <summary>Tokens were issued.</summary>
    Succeeded,

    /// <summary>The errand expired before completion.</summary>
    Expired,
}
