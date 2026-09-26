package com.contextos.video;

import java.util.Optional;

public interface VideoRepository {
  Optional<VideoAnalysis> findByVideoId(String videoId);

  VideoAnalysis save(VideoAnalysis analysis);
}
