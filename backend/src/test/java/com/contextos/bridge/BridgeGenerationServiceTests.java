package com.contextos.bridge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.contextos.video.Importance;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class BridgeGenerationServiceTests {
  @Test
  void validDefaultBridgeRequestReturnsResponse() {
    BridgeGenerationService service = service((request, retry) -> new BridgeResponse(
        request.primaryConcept(),
        "Think of etcd as Kubernetes' source-of-truth database.",
        true,
        "Database"
    ));

    BridgeResponse response = service.generate(validRequest(BridgeVariant.DEFAULT, List.of(new KnownAnchor("Database", "COMFORTABLE"))));

    assertThat(response.concept()).isEqualTo("etcd");
    assertThat(response.personalized()).isTrue();
    assertThat(response.anchorUsed()).isEqualTo("Database");
  }

  @Test
  void validSimplerBridgeRequestReturnsResponse() {
    BridgeGenerationService service = service((request, retry) -> new BridgeResponse(
        request.primaryConcept(),
        "etcd stores important cluster information.",
        false,
        null
    ));

    BridgeResponse response = service.generate(validRequest(BridgeVariant.SIMPLER, List.of()));

    assertThat(response.explanation()).contains("stores important");
    assertThat(response.personalized()).isFalse();
  }

  @Test
  void validRepairBridgeRequestReturnsResponse() {
    BridgeGenerationService service = service(new MockBridgeGenerator());

    BridgeResponse response = service.generate(validRequest(BridgeVariant.REPAIR, List.of(new KnownAnchor("Database", "COMFORTABLE"))));

    assertThat(response.concept()).isEqualTo("etcd");
    assertThat(response.explanation()).contains("background this section may be assuming");
  }

  @Test
  void invalidRequestIsRejected() {
    BridgeGenerationService service = service((request, retry) -> new BridgeResponse("etcd", "ok", false, null));

    assertThatThrownBy(() -> service.generate(new BridgeRequest(
        "",
        "segment-1",
        "etcd",
        "",
        "",
        "",
        Importance.CORE,
        List.of(),
        List.of(),
        BridgeVariant.DEFAULT,
        BridgeGoal.UNDERSTAND
    ))).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void maxAnchorsAreEnforcedBeforeGeneration() {
    List<BridgeRequest> seen = new ArrayList<>();
    BridgeGenerationService service = service((request, retry) -> {
      seen.add(request);
      return new BridgeResponse("etcd", "ok", false, null);
    });

    service.generate(validRequest(BridgeVariant.DEFAULT, List.of(
        new KnownAnchor("Database", "COMFORTABLE"),
        new KnownAnchor("REST API", "COMFORTABLE"),
        new KnownAnchor("Java", "COMFORTABLE"),
        new KnownAnchor("Docker", "COMFORTABLE")
    )));

    assertThat(seen.getFirst().knownAnchors()).hasSize(3);
  }

  @Test
  void goalIsPreservedBeforeGeneration() {
    List<BridgeRequest> seen = new ArrayList<>();
    BridgeGenerationService service = service((request, retry) -> {
      seen.add(request);
      return new BridgeResponse("etcd", "Build lens response.", false, null);
    });

    service.generate(validRequest(BridgeVariant.DEFAULT, List.of(), BridgeGoal.BUILD));

    assertThat(seen.getFirst().goal()).isEqualTo(BridgeGoal.BUILD);
  }

  @Test
  void mockGeneratorFramesInterviewGoal() {
    BridgeGenerationService service = service(new MockBridgeGenerator());

    BridgeResponse response = service.generate(validRequest(BridgeVariant.DEFAULT, List.of(), BridgeGoal.INTERVIEW));

    assertThat(response.explanation()).contains("Interview lens");
  }

  @Test
  void malformedGeneratorOutputRetriesThenFallsBack() {
    AtomicInteger calls = new AtomicInteger();
    BridgeGenerationService service = service((request, retry) -> {
      calls.incrementAndGet();
      return new BridgeResponse("", "", false, null);
    });

    BridgeResponse response = service.generate(validRequest(BridgeVariant.DEFAULT, List.of()));

    assertThat(calls).hasValue(2);
    assertThat(response.explanation()).isEqualTo("etcd stores Kubernetes cluster state.");
    assertThat(response.personalized()).isFalse();
  }

  @Test
  void generatorErrorIsBridgeFailureNotVideoAnalysisFailure() {
    BridgeGenerationService service = service((request, retry) -> {
      throw new BridgeGenerationException("Gemini permission denied");
    });

    assertThatThrownBy(() -> service.generate(validRequest(BridgeVariant.DEFAULT, List.of())))
        .isInstanceOf(BridgeGenerationException.class)
        .hasMessageContaining("Gemini permission denied");
  }

  @Test
  void oversizedExplanationFallsBack() {
    String longExplanation = "x".repeat(800);
    BridgeGenerationService service = service((request, retry) -> new BridgeResponse("etcd", longExplanation, false, null));

    BridgeResponse response = service.generate(validRequest(BridgeVariant.DEFAULT, List.of()));

    assertThat(response.explanation()).isEqualTo("etcd stores Kubernetes cluster state.");
    assertThat(response.personalized()).isFalse();
  }

  @Test
  void anchorUsedMustBeSupplied() {
    BridgeGenerationService service = service((request, retry) -> new BridgeResponse(
        "etcd",
        "Think of etcd like a database.",
        true,
        "Spreadsheets"
    ));

    BridgeResponse response = service.generate(validRequest(BridgeVariant.DEFAULT, List.of(new KnownAnchor("Database", "COMFORTABLE"))));

    assertThat(response.personalized()).isFalse();
    assertThat(response.anchorUsed()).isNull();
    assertThat(response.explanation()).isEqualTo("etcd stores Kubernetes cluster state.");
  }

  private BridgeGenerationService service(BridgeGenerator generator) {
    return new BridgeGenerationService(generator, new BridgeValidator());
  }

  private BridgeRequest validRequest(BridgeVariant variant, List<KnownAnchor> anchors) {
    return validRequest(variant, anchors, BridgeGoal.UNDERSTAND);
  }

  private BridgeRequest validRequest(BridgeVariant variant, List<KnownAnchor> anchors, BridgeGoal goal) {
    return new BridgeRequest(
        "video-1",
        "segment-1",
        "etcd",
        "A distributed key-value store.",
        "etcd",
        "etcd stores Kubernetes cluster state.",
        Importance.CORE,
        List.of("Kubernetes cluster state"),
        anchors,
        variant,
        goal
    );
  }
}
