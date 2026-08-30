package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Pairwise Agent/Automation actor embedded in a Workload access token. */
public final class WorkloadActor {
    @JsonProperty("sub") public String subject;
}
