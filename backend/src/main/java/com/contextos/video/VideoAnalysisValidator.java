package com.contextos.video;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class VideoAnalysisValidator {
  private static final int MAX_SEGMENTS = 18;
  private static final int MAX_CONCEPTS_PER_SEGMENT = 5;
  private static final int MAX_OVERLAP_SECONDS = 5;

  public VideoAnalysisValidationResult validate(VideoAnalysis candidate) {
    List<String> errors = new ArrayList<>();

    if (candidate == null) {
      return new VideoAnalysisValidationResult(false, null, List.of("analysis is null"));
    }

    ContentMode contentMode = candidate.contentMode() == null ? ContentMode.CONTEXTUAL : candidate.contentMode();
    ContextValue contextValue = candidate.contextValue() == null ? ContextValue.LOW : candidate.contextValue();
    List<ConceptSegment> sourceSegments = candidate.segments() == null ? List.of() : candidate.segments();

    if (isBlank(candidate.videoId())) {
      errors.add("videoId missing");
    }

    if (candidate.processingStatus() == ProcessingStatus.FAILED) {
      VideoAnalysis failed = new VideoAnalysis(
          candidate.videoId(),
          candidate.youtubeUrl(),
          candidate.title(),
          contentMode,
          contextValue,
          nullToEmpty(candidate.summary()),
          ProcessingStatus.FAILED,
          candidate.analyzedAt() == null ? Instant.now() : candidate.analyzedAt(),
          candidate.modelVersion(),
          List.of()
      );
      return new VideoAnalysisValidationResult(true, failed, List.of());
    }

    if (contentMode == ContentMode.PASSIVE || contextValue == ContextValue.NONE) {
      VideoAnalysis quiet = new VideoAnalysis(
          candidate.videoId(),
          candidate.youtubeUrl(),
          candidate.title(),
          contentMode,
          contextValue == ContextValue.NONE ? ContextValue.NONE : ContextValue.LOW,
          nullToEmpty(candidate.summary()),
          ProcessingStatus.NO_CONTEXT_REQUIRED,
          candidate.analyzedAt() == null ? Instant.now() : candidate.analyzedAt(),
          candidate.modelVersion(),
          List.of()
      );
      return new VideoAnalysisValidationResult(true, quiet, List.of());
    }

    if (sourceSegments.size() > MAX_SEGMENTS) {
      errors.add("too many segments");
    }

    List<ConceptSegment> normalized = sourceSegments.stream()
        .filter(segment -> segment != null)
        .sorted(Comparator.comparingInt(ConceptSegment::startSeconds))
        .limit(MAX_SEGMENTS)
        .map(this::normalizeSegment)
        .toList();

    if (normalized.isEmpty()) {
      errors.add("no meaningful segments");
    }

    Set<String> ids = new HashSet<>();
    for (ConceptSegment segment : normalized) {
      if (segment.startSeconds() < 0) {
        errors.add("negative startSeconds");
      }
      if (segment.endSeconds() <= segment.startSeconds()) {
        errors.add("endSeconds must be greater than startSeconds");
      }
      if (isBlank(segment.title()) || isBlank(segment.concept())) {
        errors.add("blank segment title/concept");
      }
      if (segment.concepts().isEmpty()) {
        errors.add("segment has no concepts");
      }
      if (segment.concepts().stream().anyMatch(concept -> isBlank(concept.canonicalName()))) {
        errors.add("concept has blank canonicalName");
      }
      if (!ids.add(segment.id())) {
        errors.add("duplicate segment id: " + segment.id());
      }
    }

    for (int index = 1; index < normalized.size(); index++) {
      ConceptSegment previous = normalized.get(index - 1);
      ConceptSegment current = normalized.get(index);
      if (previous.endSeconds() - current.startSeconds() > MAX_OVERLAP_SECONDS) {
        errors.add("segments overlap too much");
      }
    }

    VideoAnalysis normalizedAnalysis = new VideoAnalysis(
        candidate.videoId(),
        candidate.youtubeUrl(),
        candidate.title(),
        contentMode,
        contextValue,
        nullToEmpty(candidate.summary()),
        errors.isEmpty() ? ProcessingStatus.READY : ProcessingStatus.FAILED,
        candidate.analyzedAt() == null ? Instant.now() : candidate.analyzedAt(),
        candidate.modelVersion(),
        normalized
    );

    return new VideoAnalysisValidationResult(errors.isEmpty(), normalizedAnalysis, List.copyOf(errors));
  }

  private ConceptSegment normalizeSegment(ConceptSegment segment) {
    List<Concept> concepts = normalizeConcepts(segment);
    String title = firstNonBlank(segment.title(), segment.concept(), concepts.isEmpty() ? "Concept" : concepts.getFirst().canonicalName());
    String conceptName = firstNonBlank(segment.concept(), title);
    String id = firstNonBlank(segment.id(), slug(conceptName));

    return new ConceptSegment(
        id,
        title,
        conceptName,
        nullToEmpty(segment.description()),
        Math.max(0, segment.startSeconds()),
        segment.endSeconds(),
        segment.difficulty() == null ? Difficulty.INTERMEDIATE : segment.difficulty(),
        segment.importance() == null ? Importance.MEDIUM : segment.importance(),
        concepts,
        segment.prerequisites() == null ? List.of() : segment.prerequisites().stream().filter(item -> !isBlank(item)).distinct().toList(),
        segment.relatedConcepts() == null ? List.of() : segment.relatedConcepts().stream().filter(item -> !isBlank(item)).distinct().toList()
    );
  }

  private List<Concept> normalizeConcepts(ConceptSegment segment) {
    List<Concept> source = segment.concepts() == null ? List.of() : segment.concepts();
    List<Concept> normalized = source.stream()
        .filter(concept -> concept != null && !isBlank(concept.name()))
        .map(concept -> new Concept(
            concept.name().trim(),
            firstNonBlank(concept.canonicalName(), concept.name()).trim(),
            nullToEmpty(concept.description()),
            concept.aliases() == null ? List.of() : concept.aliases().stream()
                .filter(alias -> !isBlank(alias))
                .map(String::trim)
                .distinct()
                .limit(3)
                .toList()
        ))
        .distinct()
        .limit(MAX_CONCEPTS_PER_SEGMENT)
        .toList();

    if (!normalized.isEmpty()) {
      return normalized;
    }

    String conceptName = firstNonBlank(segment.concept(), segment.title());
    if (isBlank(conceptName)) {
      return List.of();
    }

    return List.of(new Concept(conceptName, conceptName, nullToEmpty(segment.description())));
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (!isBlank(value)) {
        return value;
      }
    }
    return "";
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private String slug(String value) {
    String slug = value == null ? "" : value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    return slug.isBlank() ? "concept" : slug;
  }
}
