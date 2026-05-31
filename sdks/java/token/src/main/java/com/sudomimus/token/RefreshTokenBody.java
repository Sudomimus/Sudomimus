package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus refresh token. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class RefreshTokenBody {

    /**
     * The application-visible sector subject (the same pairwise identifier
     * as the access-token body). The refresh token leaves the system, so it
     * must never carry the raw internal account identifier.
     */
    @JsonProperty("subject") public String subject;
}
