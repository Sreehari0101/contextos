package com.contextos.video;

import java.util.List;

public record VideoAnalysisValidationResult(
    boolean valid,
    VideoAnalysis analysis,
    List<String> errors
) {}
