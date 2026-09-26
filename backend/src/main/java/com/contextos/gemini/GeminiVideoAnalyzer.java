package com.contextos.gemini;

import com.contextos.config.ContextOsProperties;
import com.contextos.video.Concept;
import com.contextos.video.ConceptSegment;
import com.contextos.video.ContentMode;
import com.contextos.video.ContextValue;
import com.contextos.video.Difficulty;
import com.contextos.video.Importance;
import com.contextos.video.ProcessingStatus;
import com.contextos.video.VideoAnalysis;
import com.contextos.video.VideoAnalysisValidationResult;
import com.contextos.video.VideoAnalysisValidator;
import com.contextos.video.VideoAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "contextos.gemini.enabled", havingValue = "true")
public class GeminiVideoAnalyzer implements VideoAnalyzer {
  private static final Logger log = LoggerFactory.getLogger(GeminiVideoAnalyzer.class);

  private final ContextOsProperties properties;
  private final ObjectMapper objectMapper;
  private final VideoAnalysisValidator validator;
  private final Client client;

  public GeminiVideoAnalyzer(
      ContextOsProperties properties,
      ObjectMapper objectMapper,
      VideoAnalysisValidator validator
  ) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.validator = validator;
    this.client = new Client();
  }

  @Override
  public VideoAnalysis analyze(String videoId, String youtubeUrl, String title) {
    long startedAt = System.nanoTime();
    log.info("GEMINI_ANALYSIS_STARTED videoId={} model={}", videoId, properties.gemini().model());
    try {
      VideoAnalysisValidationResult first = analyzeOnce(videoId, youtubeUrl, title, false);
      if (first.valid()) {
        logCompletion(videoId, first.analysis(), startedAt, false);
        return first.analysis();
      }

      log.warn("GEMINI_ANALYSIS_VALIDATION_RETRY videoId={} errors={}", videoId, first.errors());
      VideoAnalysisValidationResult retry = analyzeOnce(videoId, youtubeUrl, title, true);
      if (retry.valid()) {
        logCompletion(videoId, retry.analysis(), startedAt, true);
        return retry.analysis();
      }

      log.warn("GEMINI_ANALYSIS_VALIDATION_FAILED videoId={} errors={}", videoId, retry.errors());
      return failed(videoId, youtubeUrl, title);
    } catch (Exception error) {
      log.warn("GEMINI_ANALYSIS_FAILED videoId={}", videoId, error);
      return failed(videoId, youtubeUrl, title);
    }
  }

  private VideoAnalysisValidationResult analyzeOnce(String videoId, String youtubeUrl, String title, boolean correctionRetry) throws Exception {
    GenerateContentResponse response = client.models.generateContent(
        properties.gemini().model(),
        prompt(youtubeUrl, title, correctionRetry),
        GenerateContentConfig.builder()
            .responseMimeType("application/json")
            .candidateCount(1)
            .responseSchema(responseSchema())
            .build()
    );

    String text = response.text();
    if (text == null || text.isBlank()) {
      return new VideoAnalysisValidationResult(false, failed(videoId, youtubeUrl, title), List.of("empty Gemini response"));
    }

    GeminiAnalysis geminiAnalysis = objectMapper.readValue(text, GeminiAnalysis.class);
    VideoAnalysis candidate = toAnalysis(videoId, youtubeUrl, title, geminiAnalysis);
    return validator.validate(candidate);
  }

  private String prompt(String youtubeUrl, String title, boolean correctionRetry) {
    String retryInstruction = correctionRetry
        ? "\nThe previous response failed validation. Return corrected JSON only. Do not add prose. Do not invent concepts for passive videos.\n"
        : "";

    return """
        You are the video understanding engine for ContextOS, a Chrome side panel that appears beside real YouTube videos.

        Your job is NOT to summarize the video. Your job is to decide whether automatic contextual help would improve understanding, then extract a sparse timestamped concept timeline only when useful.

        YouTube URL:
        %s

        Page title, if available:
        %s

        Classify contentMode:
        - LEARNING: tutorials, technical videos, science/history explainers, educational documentaries, finance explainers, how-to content.
        - CONTEXTUAL: not primarily educational, but contextual references may help: travel, news analysis, movie reviews, sports analysis, cultural discussion.
        - PASSIVE: automatic intervention would usually harm the experience: music videos, stand-up comedy, pure entertainment, memes, cartoons for entertainment, low-density reaction videos.

        Classify contextValue:
        - HIGH: strong conceptual learning value.
        - MEDIUM: useful context at some timestamps.
        - LOW: occasional context only.
        - NONE: no automatic context should be shown.

        Rules:
        - For PASSIVE or contextValue NONE, return segments as an empty array.
        - Never fabricate educational concepts for passive videos.
        - Prefer fewer high-value segments over many noisy ones.
        - Use approximate timestamps in seconds.
        - Extract meaningful concepts only, not generic words like Video, Person, Speaking, Comedy, YouTube.
        - Include prerequisites only when genuinely useful.
        - Keep segment count under 18.
        %s
        """.formatted(youtubeUrl, title == null ? "" : title, retryInstruction);
  }

  private VideoAnalysis toAnalysis(String videoId, String youtubeUrl, String fallbackTitle, GeminiAnalysis geminiAnalysis) {
    ContentMode contentMode = parseContentMode(geminiAnalysis.contentMode());
    ContextValue contextValue = parseContextValue(geminiAnalysis.contextValue(), contentMode);
    List<ConceptSegment> segments = safeList(geminiAnalysis.segments()).stream()
        .map(segment -> new ConceptSegment(
            slug(firstNonBlank(segment.title(), firstConceptName(segment.concepts()), "segment")),
            firstNonBlank(segment.title(), firstConceptName(segment.concepts()), "Concept"),
            firstNonBlank(firstConceptName(segment.concepts()), segment.title(), "Concept"),
            segment.description(),
            segment.startSeconds(),
            segment.endSeconds(),
            parseDifficulty(segment.difficulty()),
            parseImportance(segment.importance()),
            safeList(segment.concepts()).stream()
                .map(concept -> new Concept(
                    concept.name(),
                    firstNonBlank(concept.canonicalName(), concept.name()),
                    concept.description()
                ))
                .toList(),
            safeList(segment.prerequisites()),
            List.of()
        ))
        .toList();

    return new VideoAnalysis(
        videoId,
        youtubeUrl,
        firstNonBlank(geminiAnalysis.title(), fallbackTitle, "YouTube video"),
        contentMode,
        contextValue,
        firstNonBlank(geminiAnalysis.summary(), ""),
        ProcessingStatus.READY,
        Instant.now(),
        properties.gemini().model(),
        segments
    );
  }

  private VideoAnalysis failed(String videoId, String youtubeUrl, String title) {
    return new VideoAnalysis(
        videoId,
        youtubeUrl,
        title,
        ContentMode.CONTEXTUAL,
        ContextValue.NONE,
        "",
        ProcessingStatus.FAILED,
        Instant.now(),
        properties.gemini().model(),
        List.of()
    );
  }

  private Schema responseSchema() {
    Schema stringArray = Schema.builder()
        .type(Type.Known.ARRAY)
        .items(Schema.builder().type(Type.Known.STRING).build())
        .build();

    Schema concept = Schema.builder()
        .type(Type.Known.OBJECT)
        .properties(Map.of(
            "name", Schema.builder().type(Type.Known.STRING).build(),
            "canonicalName", Schema.builder().type(Type.Known.STRING).build(),
            "description", Schema.builder().type(Type.Known.STRING).build()
        ))
        .required("name", "canonicalName", "description")
        .build();

    Schema segment = Schema.builder()
        .type(Type.Known.OBJECT)
        .properties(Map.of(
            "startSeconds", Schema.builder().type(Type.Known.INTEGER).build(),
            "endSeconds", Schema.builder().type(Type.Known.INTEGER).build(),
            "title", Schema.builder().type(Type.Known.STRING).build(),
            "description", Schema.builder().type(Type.Known.STRING).build(),
            "difficulty", Schema.builder()
                .type(Type.Known.STRING)
                .enum_(List.of("BEGINNER", "INTERMEDIATE", "ADVANCED"))
                .build(),
            "importance", Schema.builder()
                .type(Type.Known.STRING)
                .enum_(List.of("LOW", "MEDIUM", "HIGH", "CORE"))
                .build(),
            "concepts", Schema.builder()
                .type(Type.Known.ARRAY)
                .items(concept)
                .build(),
            "prerequisites", stringArray
        ))
        .required(
            "startSeconds",
            "endSeconds",
            "title",
            "description",
            "difficulty",
            "importance",
            "concepts",
            "prerequisites"
        )
        .build();

    return Schema.builder()
        .type(Type.Known.OBJECT)
        .properties(Map.of(
            "title", Schema.builder().type(Type.Known.STRING).build(),
            "contentMode", Schema.builder()
                .type(Type.Known.STRING)
                .enum_(List.of("LEARNING", "CONTEXTUAL", "PASSIVE"))
                .build(),
            "contextValue", Schema.builder()
                .type(Type.Known.STRING)
                .enum_(List.of("HIGH", "MEDIUM", "LOW", "NONE"))
                .build(),
            "summary", Schema.builder().type(Type.Known.STRING).build(),
            "segments", Schema.builder()
                .type(Type.Known.ARRAY)
                .items(segment)
                .build()
        ))
        .required("title", "contentMode", "contextValue", "summary", "segments")
        .build();
  }

  private ContentMode parseContentMode(String value) {
    try {
      return ContentMode.valueOf(value);
    } catch (Exception ignored) {
      return ContentMode.CONTEXTUAL;
    }
  }

  private ContextValue parseContextValue(String value, ContentMode contentMode) {
    try {
      return ContextValue.valueOf(value);
    } catch (Exception ignored) {
      return contentMode == ContentMode.PASSIVE ? ContextValue.NONE : ContextValue.MEDIUM;
    }
  }

  private Difficulty parseDifficulty(String value) {
    try {
      return Difficulty.valueOf(value);
    } catch (Exception ignored) {
      return Difficulty.INTERMEDIATE;
    }
  }

  private Importance parseImportance(String value) {
    try {
      return Importance.valueOf(value);
    } catch (Exception ignored) {
      return Importance.MEDIUM;
    }
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? List.of() : values;
  }

  private String slug(String value) {
    return value == null ? "concept" : value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
  }

  private String firstConceptName(List<GeminiConcept> concepts) {
    return safeList(concepts).stream()
        .map(concept -> firstNonBlank(concept.canonicalName(), concept.name()))
        .filter(value -> !value.isBlank())
        .findFirst()
        .orElse("");
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }
    return "";
  }

  private void logCompletion(String videoId, VideoAnalysis analysis, long startedAt, boolean retry) {
    long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    log.info(
        "GEMINI_ANALYSIS_COMPLETED videoId={} status={} contentMode={} contextValue={} segmentCount={} latencyMs={} retry={}",
        videoId,
        analysis.processingStatus(),
        analysis.contentMode(),
        analysis.contextValue(),
        analysis.segments().size(),
        latencyMs,
        retry
    );
  }

  private record GeminiAnalysis(
      String title,
      String contentMode,
      String contextValue,
      String summary,
      List<GeminiSegment> segments
  ) {}

  private record GeminiSegment(
      int startSeconds,
      int endSeconds,
      String title,
      String description,
      String difficulty,
      String importance,
      List<GeminiConcept> concepts,
      List<String> prerequisites
  ) {}

  private record GeminiConcept(
      String name,
      String canonicalName,
      String description
  ) {}
}
