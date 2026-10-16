package com.contextos.bridge;

import com.contextos.config.ContextOsProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "contextos.gemini.enabled", havingValue = "true")
public class GeminiBridgeGenerator implements BridgeGenerator {
  private final ContextOsProperties properties;
  private final ObjectMapper objectMapper;
  private final Client client;

  public GeminiBridgeGenerator(ContextOsProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.client = new Client();
  }

  @Override
  public BridgeResponse generate(BridgeRequest request, boolean correctionRetry) {
    try {
      GenerateContentResponse response = client.models.generateContent(
          properties.gemini().model(),
          prompt(request, correctionRetry),
          GenerateContentConfig.builder()
              .responseMimeType("application/json")
              .candidateCount(1)
              .responseSchema(responseSchema())
              .build()
      );

      String text = response.text();
      if (text == null || text.isBlank()) {
        throw new BridgeGenerationException("Empty Gemini bridge response");
      }

      GeminiBridgeResponse geminiResponse = objectMapper.readValue(text, GeminiBridgeResponse.class);
      return new BridgeResponse(
          trimToEmpty(geminiResponse.concept()),
          trimToEmpty(geminiResponse.explanation()),
          geminiResponse.personalized(),
          blankToNull(geminiResponse.anchorUsed())
      );
    } catch (BridgeGenerationException error) {
      throw error;
    } catch (Exception error) {
      throw new BridgeGenerationException("Gemini bridge generation failed", error);
    }
  }

  private String prompt(BridgeRequest request, boolean correctionRetry) {
    String retry = correctionRetry
        ? "\nThe previous response failed validation. Return corrected JSON only. Keep it short and valid.\n"
        : "";
    return """
        Generate the minimum context required for this viewer to follow the current video section.

        Return JSON only with:
        concept, explanation, personalized, anchorUsed

        Current concept:
        %s

        Concept description:
        %s

        Segment title:
        %s

        Segment description:
        %s

        Importance:
        %s

        Prerequisites:
        %s

        Known anchors supplied by the viewer profile, maximum 3:
        %s

        Variant:
        %s

        Goal:
        %s

        Goal instruction:
        %s

        Rules:
        1. Maximum 2-4 short sentences.
        2. Target roughly 30-80 words for DEFAULT.
        3. For INTERVIEW and BUILD, stay roughly 30-90 words.
        4. For SIMPLER, use simpler vocabulary, shorter sentences, and roughly 20-60 words while still respecting the selected goal.
        5. For REPAIR, explain the missing prerequisite just enough for the viewer to continue understanding the current concept, roughly 25-80 words.
        6. Use a known anchor only if genuinely useful.
        7. Do not claim the viewer knows anything unless supplied as a known anchor.
        8. Do not invent facts about the user.
        9. Explain the current concept, not the entire topic.
        10. Avoid repeating the video verbatim.
        11. No greetings.
        12. No "As an AI".
        13. No markdown headings.
        14. Avoid unnecessary jargon.
        15. If no supplied anchor helps, set personalized=false and anchorUsed=null.
        16. anchorUsed must exactly match one supplied anchor concept or be null.
        17. Accuracy is more important than cleverness.
        18. Do not generate lists of interview questions, code tutorials, or long architecture advice.
        %s
        """.formatted(
        request.primaryConcept(),
        request.conceptDescription(),
        request.segmentTitle(),
        request.segmentDescription(),
        request.importance(),
        request.prerequisites(),
        request.knownAnchors(),
        request.variant(),
        request.goal(),
        goalInstruction(request.goal()),
        retry
    );
  }

  private String goalInstruction(BridgeGoal goal) {
    return switch (goal == null ? BridgeGoal.UNDERSTAND : goal) {
      case UNDERSTAND -> "Explain only what is necessary to conceptually follow the current section.";
      case INTERVIEW -> "Explain what is necessary to understand the concept and, only if useful, include one concise interview-relevant distinction, constraint, or common question.";
      case BUILD -> "Explain what is necessary to understand the concept and, only if useful, include one practical implementation implication or engineering consideration.";
    };
  }

  private Schema responseSchema() {
    return Schema.builder()
        .type(Type.Known.OBJECT)
        .properties(Map.of(
            "concept", Schema.builder().type(Type.Known.STRING).build(),
            "explanation", Schema.builder().type(Type.Known.STRING).build(),
            "personalized", Schema.builder().type(Type.Known.BOOLEAN).build(),
            "anchorUsed", Schema.builder().type(Type.Known.STRING).nullable(true).build()
        ))
        .required("concept", "explanation", "personalized", "anchorUsed")
        .build();
  }

  private String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record GeminiBridgeResponse(
      String concept,
      String explanation,
      boolean personalized,
      String anchorUsed
  ) {}
}
