package com.contextos.context;

import static org.assertj.core.api.Assertions.assertThat;

import com.contextos.manifest.ContextManifest;
import com.contextos.video.Concept;
import com.contextos.video.ConceptSegment;
import com.contextos.video.ContentMode;
import com.contextos.video.ContextValue;
import com.contextos.video.Difficulty;
import com.contextos.video.Importance;
import com.contextos.video.ProcessingStatus;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContextPolicyEngineTests {
  private final ContextPolicyEngine policyEngine = new ContextPolicyEngine();

  @Test
  void returnsContextForMeaningfulSegment() {
    ContextManifest manifest = manifest(ContentMode.LEARNING, ContextValue.HIGH, ProcessingStatus.READY, List.of(segment()));

    ContextDecision decision = policyEngine.decide(manifest, 20, segment());

    assertThat(decision.contextAvailable()).isTrue();
    assertThat(decision.reason()).isEqualTo(ContextReason.CONTEXT_AVAILABLE);
    assertThat(decision.shouldShow()).isTrue();
  }

  @Test
  void returnsQuietDecisionForPassiveVideo() {
    ContextManifest manifest = manifest(ContentMode.PASSIVE, ContextValue.NONE, ProcessingStatus.NO_CONTEXT_REQUIRED, List.of());

    ContextDecision decision = policyEngine.quiet(manifest, 20);

    assertThat(decision.contextAvailable()).isFalse();
    assertThat(decision.reason()).isEqualTo(ContextReason.NO_CONTEXT_REQUIRED);
    assertThat(decision.segment()).isNull();
  }

  private ContextManifest manifest(ContentMode mode, ContextValue value, ProcessingStatus status, List<ConceptSegment> segments) {
    return new ContextManifest(
        "video",
        "Video",
        mode,
        value,
        status,
        "test",
        Instant.now(),
        segments
    );
  }

  private ConceptSegment segment() {
    return new ConceptSegment(
        "pods",
        "Pods",
        "Kubernetes Pods",
        "Pods group containers for scheduling.",
        0,
        60,
        Difficulty.BEGINNER,
        Importance.CORE,
        List.of(new Concept("Pod", "Kubernetes Pod", "Smallest deployable unit.")),
        List.of("Containers"),
        List.of()
    );
  }
}
