package com.contextos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "contextos")
public record ContextOsProperties(
    Cors cors,
    String persistence,
    Firebase firebase,
    Gemini gemini
) {
  public record Cors(String allowedOrigins) {}

  public record Firebase(boolean enabled, String projectId) {}

  public record Gemini(boolean enabled, String model) {}
}
