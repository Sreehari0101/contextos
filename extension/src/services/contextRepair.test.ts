import { buildRepairBridgeRequest, diagnoseRepairCandidate } from "./contextRepair";
import type { KnowledgeState, LocalContextProfile } from "./profileStorage";
import type { ConceptSegment, ContextManifest } from "../types/api";

function run() {
  testDirectUnknownPrerequisiteWins();
  testDirectLearningIsSecondPriority();
  testComfortableDirectPrerequisitesAreIgnored();
  testIndirectOneHopUnknownPrerequisiteIsSelected();
  testCurrentConceptFallbackWhenNoPrerequisiteIsMissing();
  testNoClearPrerequisiteWhenCurrentConceptIsComfortable();
  testEarlierTimestampUsesAliasMatch();
  testRepairBridgeRequestUsesRepairVariant();
  testCycleDoesNotRecurseForever();
  console.log("contextRepair tests passed");
}

function testDirectUnknownPrerequisiteWins() {
  const current = segment("Pods", { prerequisites: ["Docker", "Containers"] });
  const result = diagnoseRepairCandidate({
    manifest: manifest([current]),
    segment: current,
    profile: profile({ docker: "LEARNING" }),
    currentTimestamp: 120
  });

  equal(result?.canonicalName, "Containers");
  equal(result?.relationship, "DIRECT_PREREQUISITE");
  equal(result?.reason, "UNKNOWN_DIRECT_PREREQUISITE");
}

function testDirectLearningIsSecondPriority() {
  const current = segment("Pods", { prerequisites: ["Docker"] });
  const result = diagnoseRepairCandidate({
    manifest: manifest([current]),
    segment: current,
    profile: profile({ docker: "LEARNING" }),
    currentTimestamp: 120
  });

  equal(result?.canonicalName, "Docker");
  equal(result?.reason, "LEARNING_DIRECT_PREREQUISITE");
}

function testComfortableDirectPrerequisitesAreIgnored() {
  const current = segment("Pods", { prerequisites: ["Docker"] });
  const result = diagnoseRepairCandidate({
    manifest: manifest([current]),
    segment: current,
    profile: profile({ docker: "COMFORTABLE" }),
    currentTimestamp: 120
  });

  equal(result?.canonicalName, "Pods");
  equal(result?.relationship, "CURRENT_CONCEPT");
}

function testIndirectOneHopUnknownPrerequisiteIsSelected() {
  const docker = segment("Docker", { prerequisites: ["Containers"], startSeconds: 30 });
  const pods = segment("Pods", { prerequisites: ["Docker"], startSeconds: 120 });
  const result = diagnoseRepairCandidate({
    manifest: manifest([docker, pods]),
    segment: pods,
    profile: profile({ docker: "COMFORTABLE" }),
    currentTimestamp: 135
  });

  equal(result?.canonicalName, "Containers");
  equal(result?.relationship, "INDIRECT_PREREQUISITE");
  equal(result?.reason, "UNKNOWN_INDIRECT_PREREQUISITE");
}

function testCurrentConceptFallbackWhenNoPrerequisiteIsMissing() {
  const pods = segment("Pods", { prerequisites: [] });
  const result = diagnoseRepairCandidate({
    manifest: manifest([pods]),
    segment: pods,
    profile: profile(),
    currentTimestamp: 135
  });

  equal(result?.canonicalName, "Pods");
  equal(result?.relationship, "CURRENT_CONCEPT");
  equal(result?.reason, "CURRENT_CONCEPT_GAP");
}

function testNoClearPrerequisiteWhenCurrentConceptIsComfortable() {
  const pods = segment("Pods", { prerequisites: [] });
  const result = diagnoseRepairCandidate({
    manifest: manifest([pods]),
    segment: pods,
    profile: profile({ pod: "COMFORTABLE" }),
    currentTimestamp: 135
  });

  equal(result?.reason, "NO_CLEAR_PREREQUISITE");
}

function testEarlierTimestampUsesAliasMatch() {
  const intro = segment("Kubernetes Pod", {
    title: "K8s Pod basics",
    startSeconds: 20,
    aliases: ["K8s Pod"]
  });
  const current = segment("Deployments", {
    startSeconds: 200,
    prerequisites: ["K8s Pod"]
  });
  const result = diagnoseRepairCandidate({
    manifest: manifest([intro, current]),
    segment: current,
    profile: profile(),
    currentTimestamp: 220
  });

  equal(result?.canonicalName, "K8s Pod");
  equal(result?.earlierTimestamp, 20);
}

function testRepairBridgeRequestUsesRepairVariant() {
  const current = segment("Pods", { prerequisites: ["Containers"] });
  const candidate = diagnoseRepairCandidate({
    manifest: manifest([current]),
    segment: current,
    profile: profile(),
    currentTimestamp: 120
  });
  if (!candidate) {
    throw new Error("Expected repair candidate");
  }
  const request = buildRepairBridgeRequest({
    videoId: "video-1",
    currentSegment: current,
    candidate,
    profile: profile({ database: "COMFORTABLE" }),
    goal: "BUILD"
  });

  equal(request.variant, "REPAIR");
  equal(request.goal, "BUILD");
  equal(request.primaryConcept, "Containers");
}

function testCycleDoesNotRecurseForever() {
  const pods = segment("Pods", { prerequisites: ["Docker"], startSeconds: 80 });
  const docker = segment("Docker", { prerequisites: ["Pods"], startSeconds: 20 });
  const result = diagnoseRepairCandidate({
    manifest: manifest([docker, pods]),
    segment: pods,
    profile: profile({ docker: "COMFORTABLE" }),
    currentTimestamp: 100
  });

  equal(result?.canonicalName, "Pods");
  equal(result?.relationship, "INDIRECT_PREREQUISITE");
}

function manifest(segments: ConceptSegment[]): ContextManifest {
  return {
    videoId: "video-1",
    title: "Tutorial",
    contentMode: "LEARNING",
    contextValue: "HIGH",
    status: "READY",
    modelVersion: "test",
    generatedAt: "2026-10-02T00:00:00.000Z",
    segments
  };
}

function segment(conceptName: string, overrides: Partial<ConceptSegment> & { aliases?: string[] } = {}): ConceptSegment {
  return {
    id: `${conceptName.toLowerCase().replaceAll(" ", "-")}-${overrides.startSeconds ?? 0}`,
    title: overrides.title ?? conceptName,
    concept: conceptName,
    description: `${conceptName} description.`,
    startSeconds: overrides.startSeconds ?? 0,
    endSeconds: overrides.endSeconds ?? 60,
    difficulty: "BEGINNER",
    importance: "CORE",
    concepts: [
      {
        name: conceptName,
        canonicalName: conceptName,
        description: `${conceptName} concept.`,
        aliases: overrides.aliases ?? []
      }
    ],
    prerequisites: [],
    relatedConcepts: [],
    ...overrides
  };
}

function profile(states: Record<string, KnowledgeState> = {}): LocalContextProfile {
  return {
    schemaVersion: 2,
    goal: "UNDERSTAND",
    concepts: Object.fromEntries(Object.entries(states).map(([key, state]) => [
      key,
      {
        canonicalName: key.split(" ").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
        state,
        confidence: state === "COMFORTABLE" ? 0.9 : 0.3,
        lastSeenAt: 100,
        evidenceCount: 1,
        source: "USER_EXPLICIT"
      }
    ]))
  };
}

run();

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}
