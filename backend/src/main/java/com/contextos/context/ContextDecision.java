package com.contextos.context;

import com.contextos.video.ConceptSegment;
import com.contextos.video.ContentMode;
import com.contextos.video.ContextValue;
import com.contextos.video.ProcessingStatus;
import java.util.List;

public record ContextDecision(
    String videoId,
    int timestampSeconds,
    ProcessingStatus status,
    boolean contextAvailable,
    ContextReason reason,
    ContentMode contentMode,
    ContextValue contextValue,
    boolean shouldShow,
    double contextScore,
    ConceptSegment segment,
    List<String> reasons,
    String explanation
) {}
