package com.contextos.bridge;

import com.contextos.video.Importance;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record BridgeRequest(
    @NotBlank String videoId,
    @NotBlank String segmentId,
    @NotBlank String primaryConcept,
    String conceptDescription,
    String segmentTitle,
    String segmentDescription,
    @NotNull Importance importance,
    List<String> prerequisites,
    List<KnownAnchor> knownAnchors,
    @NotNull BridgeVariant variant,
    @NotNull BridgeGoal goal
) {}
