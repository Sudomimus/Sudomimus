package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus access token. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class AccessTokenBody {

    @JsonProperty("accountIdentifier") public String accountIdentifier;
    @JsonProperty("firstName") public String firstName;
    @JsonProperty("lastName") public String lastName;
}
