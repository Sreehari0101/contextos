package com.contextos.video;

import static org.assertj.core.api.Assertions.assertThat;

import com.contextos.manifest.ContextManifest;
import com.contextos.manifest.InMemoryContextManifestRepository;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class VideoServiceTests {
  @Test
  void cacheMissAnalyzesAndSavesManifest() {
    AtomicInteger calls = new AtomicInteger();
    VideoAnalyzer analyzer = (videoId, youtubeUrl, title) -> {
      calls.incrementAndGet();
      return learningAnalysis(videoId, youtubeUrl, title);
    };
    InMemoryContextManifestRepository repository = new InMemoryContextManifestRepository();
    VideoService service = new VideoService(
        repository,
        analyzer,
        new VideoIdExtractor(),
        new VideoAnalysisValidator()
    );

    AnalyzeVideoRequest request = new AnalyzeVideoRequest("https://www.youtube.com/watch?v=abc123", "Kubernetes Tutorial");

    ContextManifest first = service.analyze(request);

    assertThat(first.status()).isEqualTo(ProcessingStatus.READY);
    assertThat(first.segments()).hasSize(1);
    assertThat(repository.findByVideoId("abc123")).isPresent();
    assertThat(calls).hasValue(1);
  }

  @Test
  void cacheHitDoesNotInvokeAnalyzerAgain() {
    AtomicInteger calls = new AtomicInteger();
    VideoAnalyzer analyzer = (videoId, youtubeUrl, title) -> {
      calls.incrementAndGet();
      return learningAnalysis(videoId, youtubeUrl, title);
    };
    VideoService service = new VideoService(
        new InMemoryContextManifestRepository(),
        analyzer,
        new VideoIdExtractor(),
        new VideoAnalysisValidator()
    );
    AnalyzeVideoRequest request = new AnalyzeVideoRequest("https://www.youtube.com/watch?v=abc123", "Kubernetes Tutorial");

    ContextManifest first = service.analyze(request);
    ContextManifest second = service.analyze(request);

    assertThat(second).isEqualTo(first);
    assertThat(calls).hasValue(1);
  }

  @Test
  void passiveManifestPersistsAsNoContextRequired() {
    VideoAnalyzer analyzer = (videoId, youtubeUrl, title) -> new VideoAnalysis(
        videoId,
        youtubeUrl,
        title,
        ContentMode.PASSIVE,
        ContextValue.NONE,
        "Music video",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(validSegment("fabricated", 0, 60))
    );
    InMemoryContextManifestRepository repository = new InMemoryContextManifestRepository();
    VideoService service = new VideoService(repository, analyzer, new VideoIdExtractor(), new VideoAnalysisValidator());

    ContextManifest manifest = service.analyze(new AnalyzeVideoRequest("https://www.youtube.com/watch?v=passive1", "Music video"));

    assertThat(manifest.status()).isEqualTo(ProcessingStatus.NO_CONTEXT_REQUIRED);
    assertThat(manifest.contentMode()).isEqualTo(ContentMode.PASSIVE);
    assertThat(manifest.segments()).isEmpty();
    assertThat(repository.findByVideoId("passive1")).contains(manifest);
  }

  @Test
  void failedAnalysisPersistsAsFailed() {
    VideoAnalyzer analyzer = (videoId, youtubeUrl, title) -> new VideoAnalysis(
        videoId,
        youtubeUrl,
        title,
        ContentMode.CONTEXTUAL,
        ContextValue.NONE,
        "",
        ProcessingStatus.FAILED,
        Instant.now(),
        "test",
        List.of()
    );
    VideoService service = new VideoService(new InMemoryContextManifestRepository(), analyzer, new VideoIdExtractor(), new VideoAnalysisValidator());

    ContextManifest manifest = service.analyze(new AnalyzeVideoRequest("https://www.youtube.com/watch?v=failed1", "Unavailable"));

    assertThat(manifest.status()).isEqualTo(ProcessingStatus.FAILED);
    assertThat(manifest.contextValue()).isEqualTo(ContextValue.NONE);
    assertThat(manifest.segments()).isEmpty();
  }

  private VideoAnalysis learningAnalysis(String videoId, String youtubeUrl, String title) {
    return new VideoAnalysis(
        videoId,
        youtubeUrl,
        title,
        ContentMode.LEARNING,
        ContextValue.HIGH,
        "Kubernetes concepts",
        ProcessingStatus.READY,
        Instant.now(),
        "test",
        List.of(new ConceptSegment(
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
        ))
    );
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
