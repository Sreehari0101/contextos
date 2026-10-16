package com.contextos.bridge;

import java.util.List;

public record BridgeValidationResult(
    boolean valid,
    List<String> errors
) {
  public static BridgeValidationResult ok() {
    return new BridgeValidationResult(true, List.of());
  }

  public static BridgeValidationResult invalid(List<String> errors) {
    return new BridgeValidationResult(false, List.copyOf(errors));
  }
}
