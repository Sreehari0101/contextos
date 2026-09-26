package com.contextos.context;

import com.contextos.manifest.ContextManifest;
import com.contextos.video.ConceptSegment;
import com.contextos.video.ContentMode;
import com.contextos.video.Importance;
import com.contextos.video.ProcessingStatus;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ContextPolicyEngine {
  public ContextDecision decide(ContextManifest manifest, int timestampSeconds, ConceptSegment segment) {
    double importance = switch (segment.importance()) {
      case CORE -> 1.0;
      case HIGH -> 0.9;
      case MEDIUM -> 0.65;
      case LOW -> 0.3;
    };
    double contentModeBoost = manifest.contentMode() == ContentMode.LEARNING ? 1.0 : 0.72;
    double knowledgeGap = 0.85;
    double goalRelevance = 0.8;
    double interruptionPreference = 0.75;
    double prerequisiteImportance = segment.prerequisites().isEmpty() ? 0.8 : 1.0;
    double score = knowledgeGap * importance * goalRelevance * interruptionPreference * prerequisiteImportance * contentModeBoost;
    boolean shouldShow = score >= 0.35;

    return new ContextDecision(
        manifest.videoId(),
        timestampSeconds,
        ProcessingStatus.READY,
        true,
        ContextReason.CONTEXT_AVAILABLE,
        manifest.contentMode(),
        manifest.contextValue(),
        shouldShow,
        Math.round(score * 100.0) / 100.0,
        segment,
        List.of("Meaningful concept at this timestamp", "Context mode: " + manifest.contentMode(), "Using default learning profile"),
        "Think of %s as a concept worth pausing on briefly. Personalized bridge generation starts next."
            .formatted(segment.concept())
    );
  }

  public ContextDecision quiet(ContextManifest manifest, int timestampSeconds) {
    return new ContextDecision(
        manifest.videoId(),
        timestampSeconds,
        ProcessingStatus.NO_CONTEXT_REQUIRED,
        false,
        ContextReason.NO_CONTEXT_REQUIRED,
        manifest.contentMode(),
        manifest.contextValue(),
        false,
        0,
        null,
        List.of("ContextOS is staying quiet for this video"),
        "No extra context needed right now."
    );
  }

  public ContextDecision unavailable(String videoId, int timestampSeconds, ProcessingStatus status, ContextReason reason) {
    return new ContextDecision(
        videoId,
        timestampSeconds,
        status,
        false,
        reason,
        null,
        null,
        false,
        0,
        null,
        List.of(reason.name()),
        null
    );
  }
}
