package com.contextos.bridge;

import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class BridgeGenerationService {
  private static final Logger log = LoggerFactory.getLogger(BridgeGenerationService.class);

  private final BridgeGenerator generator;
  private final BridgeValidator validator;

  public BridgeGenerationService(BridgeGenerator generator, BridgeValidator validator) {
    this.generator = generator;
    this.validator = validator;
  }

  public BridgeResponse generate(BridgeRequest request) {
    BridgeRequest normalized = validator.normalizeRequest(request);
    long startedAt = System.nanoTime();
    log.info(
        "BRIDGE_REQUEST_STARTED videoId={} segmentId={} concept={} variant={} anchorCount={}",
        normalized.videoId(),
        normalized.segmentId(),
        normalized.primaryConcept(),
        normalized.variant(),
        normalized.knownAnchors().size()
    );

    try {
      BridgeResponse first = generator.generate(normalized, false);
      BridgeValidationResult firstValidation = validator.validateResponse(normalized, first);
      if (firstValidation.valid()) {
        logCompleted(first, startedAt);
        return first;
      }

      log.warn("BRIDGE_RESPONSE_VALIDATION_RETRY errors={}", firstValidation.errors());
      BridgeResponse retry = generator.generate(normalized, true);
      BridgeValidationResult retryValidation = validator.validateResponse(normalized, retry);
      if (retryValidation.valid()) {
        logCompleted(retry, startedAt);
        return retry;
      }

      log.warn("BRIDGE_RESPONSE_VALIDATION_FAILED errors={}", retryValidation.errors());
      BridgeResponse fallback = validator.fallback(normalized);
      logCompleted(fallback, startedAt);
      return fallback;
    } catch (BridgeGenerationException error) {
      log.warn(
          "BRIDGE_GENERATION_FAILED videoId={} segmentId={} concept={} variant={} reason={}",
          normalized.videoId(),
          normalized.segmentId(),
          normalized.primaryConcept(),
          normalized.variant(),
          error.getMessage()
      );
      throw error;
    } catch (Exception error) {
      log.warn("BRIDGE_GENERATION_FAILED videoId={} segmentId={} concept={} variant={}", normalized.videoId(), normalized.segmentId(), normalized.primaryConcept(), normalized.variant(), error);
      throw new BridgeGenerationException("Bridge generation failed", error);
    }
  }

  private void logCompleted(BridgeResponse response, long startedAt) {
    long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    log.info(
        "BRIDGE_REQUEST_COMPLETED latencyMs={} personalized={} anchorUsed={}",
        latencyMs,
        response.personalized(),
        response.anchorUsed()
    );
  }
}
