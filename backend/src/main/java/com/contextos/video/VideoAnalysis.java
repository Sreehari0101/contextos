package com.contextos.video;

import java.time.Instant;
import java.util.List;

public record VideoAnalysis(
    String videoId,
    String youtubeUrl,
    String title,
    ContentMode contentMode,
    ContextValue contextValue,
    String summary,
    ProcessingStatus processingStatus,
    Instant analyzedAt,
    String modelVersion,
    List<ConceptSegment> segments
) {
  public VideoAnalysis(
      String videoId,
      String youtubeUrl,
      String title,
      ProcessingStatus processingStatus,
      Instant analyzedAt,
      String modelVersion,
      List<ConceptSegment> segments
  ) {
    this(
        videoId,
        youtubeUrl,
        title,
        ContentMode.LEARNING,
        ContextValue.HIGH,
        title,
        processingStatus,
        analyzedAt,
        modelVersion,
        segments
    );
  }
}
