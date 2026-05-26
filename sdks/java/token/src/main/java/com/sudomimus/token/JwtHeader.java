package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Standard JWT envelope claims that {@code @sudoo/jwt} places in the header
 * segment. Sudomimus access and refresh tokens carry these claims here rather
 * than in the body.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class JwtHeader {

    @JsonProperty("alg") public String algorithm;
    @JsonProperty("typ") public String type;
    @JsonProperty("iss") public String issuer;
    @JsonProperty("aud") public String audience;
    @JsonProperty("iat") public Long issuedAt;
    @JsonProperty("exp") public Long expiresAt;
    @JsonProperty("nbf") public Long notBefore;
    @JsonProperty("jti") public String jwtId;
    @JsonProperty("sub") public String subject;
    @JsonProperty("kty") public String keyType;
    @JsonProperty("ver") public String version;
}
