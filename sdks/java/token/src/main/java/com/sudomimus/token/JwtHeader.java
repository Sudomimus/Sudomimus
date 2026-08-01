package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Exact JOSE protected-header fields shared by application access and refresh
 * tokens. Registered JWT claims live in the payload.
 */
public final class JwtHeader {

    @JsonProperty("alg") public String algorithm;
    @JsonProperty("typ") public String type;
    @JsonProperty("kid") public String keyId;
}
