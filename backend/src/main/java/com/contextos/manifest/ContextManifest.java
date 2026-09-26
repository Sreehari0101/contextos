package com.contextos.manifest;

import com.contextos.video.ConceptSegment;
import com.contextos.video.ContentMode;
import com.contextos.video.ContextValue;
import com.contextos.video.ProcessingStatus;
import com.contextos.video.VideoAnalysis;
import java.time.Instant;
import java.util.List;

public record ContextManifest(
    String videoId,
    String title,
    ContentMode contentMode,
    ContextValue contextValue,
    ProcessingStatus status,
    String modelVersion,
    Instant generatedAt,
    List<ConceptSegment> segments
) {
  private static final String SCHEMA_VERSION = "manifest-v1";

  public static ContextManifest fromAnalysis(VideoAnalysis analysis) {
    return new ContextManifest(
        analysis.videoId(),
        analysis.title(),
        analysis.contentMode(),
        analysis.contextValue(),
        analysis.processingStatus(),
        versionedModel(analysis.modelVersion()),
        analysis.analyzedAt(),
        analysis.segments() == null ? List.of() : analysis.segments()
    );
  }

  public VideoAnalysis toAnalysis(String youtubeUrl) {
    return new VideoAnalysis(
        videoId,
        youtubeUrl,
        title,
        contentMode,
        contextValue,
        "",
        status,
        generatedAt,
        modelVersion,
        segments == null ? List.of() : segments
    );
  }

  private static String versionedModel(String modelVersion) {
    String base = modelVersion == null || modelVersion.isBlank() ? "unknown" : modelVersion;
    return base.endsWith(":" + SCHEMA_VERSION) ? base : base + ":" + SCHEMA_VERSION;
  }
}
