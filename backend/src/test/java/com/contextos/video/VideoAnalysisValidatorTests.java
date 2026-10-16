package com.contextos.video;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class VideoAnalysisValidatorTests {
  private final VideoAnalysisValidator validator = new VideoAnalysisValidator();

  @Test
  void passiveVideoBecomesNoContextRequiredAndDropsSegments() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "passive",
        "https://youtube.com/watch?v=passive",
        "Stand-up clip",
        ContentMode.PASSIVE,
        ContextValue.LOW,
        "Entertainment clip",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(validSegment("joke-structure", 0, 60))
    ));

    assertThat(result.valid()).isTrue();
    assertThat(result.analysis().processingStatus()).isEqualTo(ProcessingStatus.NO_CONTEXT_REQUIRED);
    assertThat(result.analysis().segments()).isEmpty();
  }

  @Test
  void rejectsInvalidTimestamps() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "bad-time",
        "https://youtube.com/watch?v=bad",
        "Bad",
        ContentMode.LEARNING,
        ContextValue.HIGH,
        "Bad timestamps",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(validSegment("pods", 100, 90))
    ));

    assertThat(result.valid()).isFalse();
    assertThat(result.errors()).contains("endSeconds must be greater than startSeconds");
    assertThat(result.analysis().processingStatus()).isEqualTo(ProcessingStatus.FAILED);
  }

  @Test
  void rejectsEmptyLearningSegments() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "empty",
        "https://youtube.com/watch?v=empty",
        "Empty",
        ContentMode.LEARNING,
        ContextValue.HIGH,
        "Empty",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of()
    ));

    assertThat(result.valid()).isFalse();
    assertThat(result.errors()).contains("no meaningful segments");
  }

  @Test
  void preservesFailedAnalysisStatus() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "failed",
        "https://youtube.com/watch?v=failed",
        "Failed",
        ContentMode.CONTEXTUAL,
        ContextValue.NONE,
        "",
        ProcessingStatus.FAILED,
        Instant.now(),
        "test",
        List.of()
    ));

    assertThat(result.valid()).isTrue();
    assertThat(result.analysis().processingStatus()).isEqualTo(ProcessingStatus.FAILED);
    assertThat(result.analysis().segments()).isEmpty();
  }

  @Test
  void rejectsMissingVideoId() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "",
        "https://youtube.com/watch?v=missing",
        "Missing id",
        ContentMode.LEARNING,
        ContextValue.HIGH,
        "",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(validSegment("pods", 0, 60))
    ));

    assertThat(result.valid()).isFalse();
    assertThat(result.errors()).contains("videoId missing");
    assertThat(result.analysis().processingStatus()).isEqualTo(ProcessingStatus.FAILED);
  }

  @Test
  void rejectsAbsurdSegmentOverlap() {
    VideoAnalysisValidationResult result = validator.validate(new VideoAnalysis(
        "overlap",
        "https://youtube.com/watch?v=overlap",
        "Overlap",
        ContentMode.LEARNING,
        ContextValue.HIGH,
        "",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(
            validSegment("pods", 0, 100),
            validSegment("services", 80, 140)
        )
    ));

    assertThat(result.valid()).isFalse();
    assertThat(result.errors()).contains("segments overlap too much");
  }

  private ConceptSegment validSegment(String id, int start, int end) {
    return new ConceptSegment(
        id,
        "Pods",
        "Kubernetes Pods",
        "Pods group containers for scheduling.",
        start,
        end,
        Difficulty.BEGINNER,
        Importance.CORE,
        List.of(new Concept("Pod", "Kubernetes Pod", "Smallest deployable unit.")),
        List.of("Containers"),
        List.of()
    );
  }
}
