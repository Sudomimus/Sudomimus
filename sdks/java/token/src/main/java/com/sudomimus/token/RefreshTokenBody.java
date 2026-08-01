package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus refresh token. */
public final class RefreshTokenBody {

    @JsonProperty("iss") public String issuer;
    @JsonProperty("aud") public String audience;
    @JsonProperty("sid") public String sessionId;
    @JsonProperty("jti") public String jwtId;
    @JsonProperty("iat") public Long issuedAt;
    @JsonProperty("exp") public Long expiresAt;
    @JsonProperty("rotationVersion") public Long rotationVersion;
}
