package com.contextos.video;

import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "contextos.gemini.enabled", havingValue = "false", matchIfMissing = true)
public class MockVideoAnalyzer implements VideoAnalyzer {
  @Override
  public VideoAnalysis analyze(String videoId, String youtubeUrl, String title) {
    List<ConceptSegment> segments = List.of(
        new ConceptSegment(
            "containers",
            "Containers",
            "A lightweight way to package an app with its runtime and dependencies.",
            0,
            150,
            Difficulty.BEGINNER,
            Importance.HIGH,
            List.of("applications", "operating systems"),
            List.of("Docker", "images")),
        new ConceptSegment(
            "kubernetes-why",
            "Why Kubernetes exists",
            "Kubernetes coordinates containers across machines so apps can scale and recover.",
            150,
            310,
            Difficulty.BEGINNER,
            Importance.HIGH,
            List.of("containers"),
            List.of("clusters", "orchestration")),
        new ConceptSegment(
            "pods",
            "Pods",
            "The smallest deployable unit in Kubernetes, usually wrapping one main container.",
            310,
            480,
            Difficulty.INTERMEDIATE,
            Importance.HIGH,
            List.of("containers", "Kubernetes cluster"),
            List.of("Deployments", "ReplicaSets")),
        new ConceptSegment(
            "etcd",
            "etcd",
            "Kubernetes' source-of-truth store for desired and current cluster state.",
            480,
            660,
            Difficulty.INTERMEDIATE,
            Importance.HIGH,
            List.of("Kubernetes cluster", "distributed state"),
            List.of("control plane", "API server")),
        new ConceptSegment(
            "deployments",
            "Deployments",
            "A Kubernetes controller that manages rolling updates and keeps replicas running.",
            660,
            900,
            Difficulty.INTERMEDIATE,
            Importance.HIGH,
            List.of("Pods", "ReplicaSets"),
            List.of("rollouts", "controllers"))
    );

    return new VideoAnalysis(
        videoId,
        youtubeUrl,
        title == null || title.isBlank() ? "YouTube video" : title,
        ProcessingStatus.READY,
        Instant.now(),
        "mock-phase-2",
        segments
    );
  }
}
