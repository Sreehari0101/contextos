package com.contextos.bridge;

public class BridgeGenerationException extends RuntimeException {
  public BridgeGenerationException(String message, Throwable cause) {
    super(message, cause);
  }

  public BridgeGenerationException(String message) {
    super(message);
  }
}
