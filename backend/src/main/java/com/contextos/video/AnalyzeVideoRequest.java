package com.contextos.video;

import jakarta.validation.constraints.NotBlank;

public record AnalyzeVideoRequest(
    @NotBlank String youtubeUrl,
    String title
) {}
