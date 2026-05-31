package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Decoded response of the OIDC {@code /userinfo} endpoint. {@code sub} is the
 * same sector subject carried by the id_token; the other claims are scope-gated
 * by the access token presented to {@code /userinfo}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class UserInfo {

    @JsonProperty("sub") public String subject;
    @JsonProperty("email") public String email;
    @JsonProperty("email_verified") public Boolean emailVerified;
    @JsonProperty("name") public String name;
}
