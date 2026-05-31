package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Body claims of a Sudomimus OIDC {@code id_token}. Every claim lives in the
 * JWT body (standard OIDC). {@code sub} is the per-(account, sector) sector
 * subject — identical to the access-token body {@code subject}. The token is
 * signed by the platform key, not by an application's signing key.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class IdTokenBody {

    @JsonProperty("iss") public String issuer;
    @JsonProperty("sub") public String subject;
    @JsonProperty("aud") public String audience;
    @JsonProperty("iat") public Long issuedAt;
    @JsonProperty("exp") public Long expiresAt;
    @JsonProperty("at_hash") public String atHash;
    @JsonProperty("nonce") public String nonce;
    @JsonProperty("auth_time") public Long authTime;
    @JsonProperty("email") public String email;
    @JsonProperty("email_verified") public Boolean emailVerified;
    @JsonProperty("name") public String name;
    @JsonProperty("amr") public List<String> amr;
    @JsonProperty("acr") public String acr;
}
