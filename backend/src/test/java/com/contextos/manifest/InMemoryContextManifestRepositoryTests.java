package com.contextos.manifest;

import static org.assertj.core.api.Assertions.assertThat;

import com.contextos.video.ContentMode;
import com.contextos.video.ContextValue;
import com.contextos.video.ProcessingStatus;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class InMemoryContextManifestRepositoryTests {
  @Test
  void savesReadsAndDeletesManifest() {
    InMemoryContextManifestRepository repository = new InMemoryContextManifestRepository();
    ContextManifest manifest = new ContextManifest(
        "abc123",
        "Kubernetes Tutorial",
        ContentMode.LEARNING,
        ContextValue.HIGH,
        ProcessingStatus.READY,
        "test:v1",
        Instant.now(),
        List.of()
    );

    repository.save(manifest);

    assertThat(repository.findByVideoId("abc123")).contains(manifest);

    repository.delete("abc123");

    assertThat(repository.findByVideoId("abc123")).isEmpty();
  }
}
