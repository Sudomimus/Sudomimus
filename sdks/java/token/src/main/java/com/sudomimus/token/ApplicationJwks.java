package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Response returned by the Session JWKS endpoint. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ApplicationJwks {

    @JsonProperty("keys") public List<ApplicationJsonWebKey> keys;
}
