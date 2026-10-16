package com.contextos.video;

import java.util.List;

public record Concept(
    String name,
    String canonicalName,
    String description,
    List<String> aliases
) {
  public Concept(String name, String canonicalName, String description) {
    this(name, canonicalName, description, List.of());
  }
}
