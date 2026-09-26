package com.contextos.video;

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
@ConditionalOnProperty(name = "contextos.legacy-video-repository.enabled", havingValue = "true")
public class FirestoreVideoRepository implements VideoRepository {
  private final Firestore firestore;
  private final ObjectMapper objectMapper;

  public FirestoreVideoRepository(ObjectMapper objectMapper) {
    this.firestore = FirestoreClient.getFirestore();
    this.objectMapper = objectMapper;
  }

  @Override
  public Optional<VideoAnalysis> findByVideoId(String videoId) {
    try {
      DocumentSnapshot snapshot = firestore.collection("videos").document(videoId).get().get();
      if (!snapshot.exists() || snapshot.getData() == null) {
        return Optional.empty();
      }
      return Optional.of(objectMapper.convertValue(snapshot.getData(), VideoAnalysis.class));
    } catch (Exception error) {
      throw new IllegalStateException("Failed to read video analysis from Firestore", error);
    }
  }

  @Override
  public VideoAnalysis save(VideoAnalysis analysis) {
    try {
      Map<String, Object> data = objectMapper.convertValue(analysis, new TypeReference<>() {});
      firestore.collection("videos").document(analysis.videoId()).set(data).get();
      return analysis;
    } catch (Exception error) {
      throw new IllegalStateException("Failed to save video analysis to Firestore", error);
    }
  }
}
