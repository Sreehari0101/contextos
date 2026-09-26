package com.contextos.manifest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "contextos.persistence", havingValue = "firestore")
public class FirestoreContextManifestRepository implements ContextManifestRepository {
  private static final String COLLECTION = "context_manifests";

  private final Firestore firestore;
  private final ObjectMapper objectMapper;

  public FirestoreContextManifestRepository(Firestore firestore, ObjectMapper objectMapper) {
    this.firestore = firestore;
    this.objectMapper = objectMapper;
  }

  @Override
  public Optional<ContextManifest> findByVideoId(String videoId) {
    try {
      DocumentSnapshot snapshot = firestore.collection(COLLECTION).document(videoId).get().get();
      if (!snapshot.exists() || snapshot.getData() == null) {
        return Optional.empty();
      }
      return Optional.of(objectMapper.convertValue(snapshot.getData(), ContextManifest.class));
    } catch (Exception error) {
      throw new IllegalStateException("Failed to read context manifest from Firestore", error);
    }
  }

  @Override
  public ContextManifest save(ContextManifest manifest) {
    try {
      Map<String, Object> data = objectMapper.convertValue(manifest, new TypeReference<>() {});
      firestore.collection(COLLECTION).document(manifest.videoId()).set(data).get();
      return manifest;
    } catch (Exception error) {
      throw new IllegalStateException("Failed to save context manifest to Firestore", error);
    }
  }

  @Override
  public void delete(String videoId) {
    try {
      firestore.collection(COLLECTION).document(videoId).delete().get();
    } catch (Exception error) {
      throw new IllegalStateException("Failed to delete context manifest from Firestore", error);
    }
  }
}
