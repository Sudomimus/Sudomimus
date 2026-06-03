package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus access token. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class AccessTokenBody {

    /**
     * The application-visible user identifier — the per-(account, sector)
     * "sector subject", also the OIDC {@code sub}. The raw internal account
     * identifier never appears in a token. Opaque: never parse it.
     */
    @JsonProperty("subject") public String subject;

    /**
     * Given name. Consent-gated (claim sharing): minted only when the
     * application's claim policy permits it AND the user has granted the claim,
     * so it may be {@code null} even when the account has a value stored. The
     * same gating applies to {@link #lastName} and {@link #emailAddress}.
     */
    @JsonProperty("firstName") public String firstName;
    @JsonProperty("lastName") public String lastName;
    @JsonProperty("emailAddress") public String emailAddress;
}
