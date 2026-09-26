package com.contextos.video;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "contextos.legacy-video-repository.enabled", havingValue = "true")
public class InMemoryVideoRepository implements VideoRepository {
  private final Map<String, VideoAnalysis> videos = new ConcurrentHashMap<>();

  @Override
  public Optional<VideoAnalysis> findByVideoId(String videoId) {
    return Optional.ofNullable(videos.get(videoId));
  }

  @Override
  public VideoAnalysis save(VideoAnalysis analysis) {
    videos.put(analysis.videoId(), analysis);
    return analysis;
  }
}
