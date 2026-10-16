package com.contextos.bridge;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BridgeValidator {
  static final int MAX_ANCHORS = 3;
  private static final int MAX_EXPLANATION_CHARS = 700;

  public BridgeRequest normalizeRequest(BridgeRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Bridge request is required");
    }

    String videoId = requireText(request.videoId(), "videoId");
    String segmentId = requireText(request.segmentId(), "segmentId");
    String primaryConcept = requireText(request.primaryConcept(), "primaryConcept");

    return new BridgeRequest(
        videoId,
        segmentId,
        primaryConcept,
        trimToEmpty(request.conceptDescription()),
        trimToEmpty(request.segmentTitle()),
        trimToEmpty(request.segmentDescription()),
        request.importance(),
        safeTextList(request.prerequisites()),
        safeAnchors(request.knownAnchors()),
        request.variant() == null ? BridgeVariant.DEFAULT : request.variant(),
        request.goal() == null ? BridgeGoal.UNDERSTAND : request.goal()
    );
  }

  public BridgeValidationResult validateResponse(BridgeRequest request, BridgeResponse response) {
    List<String> errors = new ArrayList<>();

    if (response == null) {
      return BridgeValidationResult.invalid(List.of("bridge response is null"));
    }

    if (isBlank(response.concept())) {
      errors.add("concept missing");
    }
    if (isBlank(response.explanation())) {
      errors.add("explanation blank");
    }
    if (response.explanation() != null && response.explanation().length() > MAX_EXPLANATION_CHARS) {
      errors.add("explanation too long");
    }
    if (!isBlank(response.anchorUsed()) && !anchorWasSupplied(request, response.anchorUsed())) {
      errors.add("anchorUsed was not supplied");
    }

    return errors.isEmpty() ? BridgeValidationResult.ok() : BridgeValidationResult.invalid(errors);
  }

  public BridgeResponse fallback(BridgeRequest request) {
    String explanation = firstNonBlank(
        request.segmentDescription(),
        request.conceptDescription(),
        request.primaryConcept() + " is the key idea in this part of the video."
    );
    return new BridgeResponse(request.primaryConcept(), explanation, false, null);
  }

  private List<String> safeTextList(List<String> values) {
    return values == null ? List.of() : values.stream()
        .filter(value -> !isBlank(value))
        .map(String::trim)
        .distinct()
        .toList();
  }

  private List<KnownAnchor> safeAnchors(List<KnownAnchor> anchors) {
    return anchors == null ? List.of() : anchors.stream()
        .filter(anchor -> anchor != null && !isBlank(anchor.concept()))
        .map(anchor -> new KnownAnchor(anchor.concept().trim(), trimToEmpty(anchor.state())))
        .distinct()
        .limit(MAX_ANCHORS)
        .toList();
  }

  private boolean anchorWasSupplied(BridgeRequest request, String anchorUsed) {
    String normalized = normalize(anchorUsed);
    return request.knownAnchors().stream()
        .map(KnownAnchor::concept)
        .map(this::normalize)
        .anyMatch(normalized::equals);
  }

  private String requireText(String value, String field) {
    if (isBlank(value)) {
      throw new IllegalArgumentException(field + " is required");
    }
    return value.trim();
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (!isBlank(value)) {
        return value.trim();
      }
    }
    return "";
  }

  private String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalize(String value) {
    return trimToEmpty(value).toLowerCase().replaceAll("\\s+", " ");
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
