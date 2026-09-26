package com.contextos.video;

import java.net.URI;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class VideoIdExtractor {
  public Optional<String> extract(String youtubeUrl) {
    try {
      URI uri = URI.create(youtubeUrl);
      String host = uri.getHost() == null ? "" : uri.getHost();
      if (host.endsWith("youtu.be")) {
        String path = uri.getPath();
        return path == null || path.length() <= 1 ? Optional.empty() : Optional.of(path.substring(1));
      }

      if (!host.endsWith("youtube.com")) {
        return Optional.empty();
      }

      String videoId = UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("v");
      return videoId == null || videoId.isBlank() ? Optional.empty() : Optional.of(videoId);
    } catch (Exception ignored) {
      return Optional.empty();
    }
  }
}
