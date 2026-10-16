package com.contextos.bridge;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "contextos.gemini.enabled", havingValue = "false", matchIfMissing = true)
public class MockBridgeGenerator implements BridgeGenerator {
  @Override
  public BridgeResponse generate(BridgeRequest request, boolean correctionRetry) {
    KnownAnchor anchor = request.knownAnchors().stream()
        .filter(candidate -> usefulAnchor(request, candidate))
        .findFirst()
        .orElse(null);

    if (request.variant() == BridgeVariant.SIMPLER) {
      return simpler(request, anchor);
    }
    if (request.variant() == BridgeVariant.REPAIR) {
      return repair(request, anchor);
    }

    if (anchor != null) {
      return new BridgeResponse(
          request.primaryConcept(),
          goalPrefix(request) + " Think of %s as playing a similar source-of-truth role to %s. %s".formatted(
              request.primaryConcept(),
              anchor.concept(),
              goalSuffix(request)
          ).trim(),
          true,
          anchor.concept()
      );
    }

    return new BridgeResponse(
        request.primaryConcept(),
        (goalPrefix(request) + " " + firstNonBlank(
            request.segmentDescription(),
            request.conceptDescription(),
            request.primaryConcept() + " is the key idea in this part of the video."
        ) + goalFallbackSuffix(request)).trim(),
        false,
        null
    );
  }

  private BridgeResponse simpler(BridgeRequest request, KnownAnchor anchor) {
    if (anchor != null) {
      return new BridgeResponse(
          request.primaryConcept(),
          ("%s is like a small source of truth for this part. It helps the system remember what should exist." + goalFallbackSuffix(request)).formatted(request.primaryConcept()).trim(),
          true,
          anchor.concept()
      );
    }

    return new BridgeResponse(
        request.primaryConcept(),
        ("%s is important here because the next part of the video depends on it. You only need the basic idea before moving on." + goalFallbackSuffix(request)).formatted(request.primaryConcept()).trim(),
        false,
        null
    );
  }

  private BridgeResponse repair(BridgeRequest request, KnownAnchor anchor) {
    String anchorText = anchor == null ? "" : " Think of it in relation to " + anchor.concept() + ".";
    return new BridgeResponse(
        request.primaryConcept(),
        ("%s is background this section may be assuming. %s%s").formatted(
            request.primaryConcept(),
            firstNonBlank(request.conceptDescription(), request.segmentDescription(), "It helps connect the current idea to what the video is explaining."),
            anchorText
        ).trim(),
        anchor != null,
        anchor == null ? null : anchor.concept()
    );
  }

  private String goalPrefix(BridgeRequest request) {
    return switch (request.goal()) {
      case UNDERSTAND -> "";
      case INTERVIEW -> "Interview lens:";
      case BUILD -> "Build lens:";
    };
  }

  private String goalSuffix(BridgeRequest request) {
    return switch (request.goal()) {
      case UNDERSTAND -> firstNonBlank(request.segmentDescription(), request.conceptDescription());
      case INTERVIEW -> firstNonBlank(request.segmentDescription(), request.conceptDescription()) + " A useful interview angle is knowing the constraint or role it creates.";
      case BUILD -> firstNonBlank(request.segmentDescription(), request.conceptDescription()) + " When building, focus on the practical implication for system behavior.";
    };
  }

  private String goalFallbackSuffix(BridgeRequest request) {
    return switch (request.goal()) {
      case UNDERSTAND -> "";
      case INTERVIEW -> " A useful interview angle is the constraint or tradeoff this concept introduces.";
      case BUILD -> " When building, notice the implementation implication for how the system behaves.";
    };
  }

  private boolean usefulAnchor(BridgeRequest request, KnownAnchor anchor) {
    String anchorText = anchor.concept().toLowerCase();
    String conceptText = (request.primaryConcept() + " " + request.conceptDescription() + " " + request.segmentDescription()).toLowerCase();
    return anchorText.contains("database")
        || anchorText.contains("state")
        || conceptText.contains(anchorText);
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }
    return "";
  }
}
