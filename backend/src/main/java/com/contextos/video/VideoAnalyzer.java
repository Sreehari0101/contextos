package com.contextos.video;

public interface VideoAnalyzer {
  VideoAnalysis analyze(String videoId, String youtubeUrl, String title);
}
