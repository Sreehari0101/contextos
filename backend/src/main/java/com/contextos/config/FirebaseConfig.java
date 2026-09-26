package com.contextos.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "contextos.persistence", havingValue = "firestore")
public class FirebaseConfig {
  public FirebaseConfig(ContextOsProperties properties) throws IOException {
    if (!FirebaseApp.getApps().isEmpty()) {
      return;
    }

    FirebaseOptions.Builder builder = FirebaseOptions.builder()
        .setCredentials(GoogleCredentials.getApplicationDefault());

    String projectId = properties.firebase().projectId();
    if (projectId != null && !projectId.isBlank()) {
      builder.setProjectId(projectId);
    }

    FirebaseApp.initializeApp(builder.build());
  }

  @Bean
  Firestore firestore() {
    return FirestoreClient.getFirestore();
  }
}
