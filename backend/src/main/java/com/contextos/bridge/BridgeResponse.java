package com.contextos.bridge;

public record BridgeResponse(
    String concept,
    String explanation,
    boolean personalized,
    String anchorUsed
) {}
