package com.contextos.manifest;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "contextos.persistence", havingValue = "memory", matchIfMissing = true)
public class InMemoryContextManifestRepository implements ContextManifestRepository {
  private final Map<String, ContextManifest> manifests = new ConcurrentHashMap<>();

  @Override
  public Optional<ContextManifest> findByVideoId(String videoId) {
    return Optional.ofNullable(manifests.get(videoId));
  }

  @Override
  public ContextManifest save(ContextManifest manifest) {
    manifests.put(manifest.videoId(), manifest);
    return manifest;
  }

  @Override
  public void delete(String videoId) {
    manifests.remove(videoId);
  }
}
