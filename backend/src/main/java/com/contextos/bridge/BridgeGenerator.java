package com.contextos.bridge;

public interface BridgeGenerator {
  BridgeResponse generate(BridgeRequest request, boolean correctionRetry);
}
