package com.contextos.video;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;

public record ConceptSegment(
    @NotBlank String id,
    @NotBlank String title,
    @NotBlank String concept,
    String description,
    @PositiveOrZero int startSeconds,
    @PositiveOrZero int endSeconds,
    Difficulty difficulty,
    Importance importance,
    List<Concept> concepts,
    List<String> prerequisites,
    List<String> relatedConcepts
) {
  public ConceptSegment(
      String id,
      String concept,
      String description,
      int startSeconds,
      int endSeconds,
      Difficulty difficulty,
      Importance importance,
      List<String> prerequisites,
      List<String> relatedConcepts
  ) {
    this(
        id,
        concept,
        concept,
        description,
        startSeconds,
        endSeconds,
        difficulty,
        importance,
        List.of(new Concept(concept, concept, description)),
        prerequisites,
        relatedConcepts
    );
  }

  public boolean contains(int timestampSeconds) {
    return timestampSeconds >= startSeconds && timestampSeconds < endSeconds;
  }
}
