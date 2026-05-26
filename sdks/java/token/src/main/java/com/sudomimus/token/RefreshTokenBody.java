package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus refresh token. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class RefreshTokenBody {

    @JsonProperty("accountIdentifier") public String accountIdentifier;
}
