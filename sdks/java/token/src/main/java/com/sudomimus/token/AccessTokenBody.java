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
    @JsonProperty("firstName") public String firstName;
    @JsonProperty("lastName") public String lastName;
    @JsonProperty("emailAddress") public String emailAddress;
}
