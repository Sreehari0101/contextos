package com.contextos.video;

import com.contextos.manifest.ContextManifest;
import com.contextos.manifest.ContextManifestRepository;
import java.util.Comparator;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class VideoService {
  private static final Logger log = LoggerFactory.getLogger(VideoService.class);

  private final ContextManifestRepository repository;
  private final VideoAnalyzer analyzer;
  private final VideoIdExtractor videoIdExtractor;
  private final VideoAnalysisValidator validator;

  public VideoService(
      ContextManifestRepository repository,
      VideoAnalyzer analyzer,
      VideoIdExtractor videoIdExtractor,
      VideoAnalysisValidator validator
  ) {
    this.repository = repository;
    this.analyzer = analyzer;
    this.videoIdExtractor = videoIdExtractor;
    this.validator = validator;
  }

  public ContextManifest analyze(AnalyzeVideoRequest request) {
    String videoId = videoIdExtractor.extract(request.youtubeUrl())
        .orElseThrow(() -> new IllegalArgumentException("Unsupported YouTube URL"));

    Optional<ContextManifest> existing = repository.findByVideoId(videoId);
    if (existing.isPresent() && isTerminal(existing.get().status())) {
      ContextManifest cached = existing.get();
      log.info(
          "CONTEXT_MANIFEST_CACHE_HIT videoId={} status={} contentMode={} segmentCount={}",
          videoId,
          cached.status(),
          cached.contentMode(),
          cached.segments().size()
      );
      return cached;
    }

    log.info("CONTEXT_MANIFEST_CACHE_MISS videoId={}", videoId);
    VideoAnalysisValidationResult validation = validator.validate(analyzer.analyze(videoId, request.youtubeUrl(), request.title()));
    VideoAnalysis analysis = validation.valid() ? validation.analysis() : validation.analysis();
    if (!validation.valid()) {
      log.warn("VIDEO_ANALYSIS_VALIDATION_FAILED videoId={} errors={}", videoId, validation.errors());
    }
    ContextManifest manifest = ContextManifest.fromAnalysis(analysis);
    repository.save(manifest);
    log.info("CONTEXT_MANIFEST_SAVED videoId={} status={} segmentCount={}", videoId, manifest.status(), manifest.segments().size());
    if (manifest.status() == ProcessingStatus.NO_CONTEXT_REQUIRED) {
      log.info("VIDEO_CLASSIFIED_PASSIVE videoId={} contentMode={} contextValue={}", videoId, analysis.contentMode(), analysis.contextValue());
    }
    return manifest;
  }

  public Optional<ContextManifest> find(String videoId) {
    return repository.findByVideoId(videoId);
  }

  public Optional<ConceptSegment> currentSegment(String videoId, int timestampSeconds) {
    return repository.findByVideoId(videoId)
        .stream()
        .flatMap(manifest -> manifest.segments().stream())
        .filter(segment -> segment.contains(timestampSeconds))
        .min(Comparator.comparingInt(ConceptSegment::startSeconds));
  }

  public Optional<ContextManifest> manifestForCurrentContext(String videoId) {
    return repository.findByVideoId(videoId);
  }

  private boolean isTerminal(ProcessingStatus status) {
    return status == ProcessingStatus.READY
        || status == ProcessingStatus.NO_CONTEXT_REQUIRED
        || status == ProcessingStatus.FAILED;
  }
}
