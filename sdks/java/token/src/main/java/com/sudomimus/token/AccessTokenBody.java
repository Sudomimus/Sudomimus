package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Body (payload) claims carried in a Sudomimus access token. */
public final class AccessTokenBody {

    @JsonProperty("iss") public String issuer;
    @JsonProperty("aud") public String audience;
    /** Pairwise application-visible user key. Opaque: never parse it. */
    @JsonProperty("sub") public String subject;
    @JsonProperty("sid") public String sessionId;
    @JsonProperty("jti") public String jwtId;
    @JsonProperty("iat") public Long issuedAt;
    @JsonProperty("exp") public Long expiresAt;
}
