package com.contextos.manifest;

import java.util.Optional;

public interface ContextManifestRepository {
  Optional<ContextManifest> findByVideoId(String videoId);

  ContextManifest save(ContextManifest manifest);

  void delete(String videoId);
}
