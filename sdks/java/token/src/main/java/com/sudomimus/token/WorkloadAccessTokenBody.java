package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Access-token payload binding an owner Account to a Workload actor. */
public final class WorkloadAccessTokenBody {
    @JsonProperty("iss") public String issuer;
    @JsonProperty("aud") public String audience;
    @JsonProperty("sub") public String subject;
    @JsonProperty("sid") public String sessionId;
    @JsonProperty("jti") public String jwtId;
    @JsonProperty("iat") public Long issuedAt;
    @JsonProperty("exp") public Long expiresAt;
    @JsonProperty("act") public WorkloadActor actor;
}
