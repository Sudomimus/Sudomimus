package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Header claims of an OIDC {@code id_token}. Unlike Sudomimus access/refresh
 * tokens, an id_token is a standard OIDC JWT: {@code kid} identifies the
 * platform signing key in the OIDC JWKS.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class IdTokenHeader {

    @JsonProperty("alg") public String algorithm;
    @JsonProperty("typ") public String type;
    @JsonProperty("kid") public String keyId;
}
