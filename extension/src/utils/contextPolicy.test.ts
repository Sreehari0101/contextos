import { createMemoryStorage, getProfile, markConceptKnown, type LocalContextProfile } from "../services/profileStorage";
import type { ConceptSegment, ContextManifest } from "../types/api";
import { calculateKnowledgeDelta, evaluateContextPolicy } from "./contextPolicy";

async function run() {
  testPassiveModeIsSilent();
  testNoContextRequiredIsSilent();
  testUnknownCoreLearningShows();
  testComfortableHighConceptIsSilent();
  testUnknownPrerequisiteRaisesGapScore();
  testContextualModeIsStricterThanLearningMode();
  testMissingConceptEntryIsUnknown();
  await testKnownClickChangesPolicyFromShowToSilent();
  await testSameCanonicalConceptAcrossVideosIsRemembered();
  testNoMeaningfulConceptIsSilent();
  testFailedAnalysisIsErrorReasonNotViewerKnowledge();
  testScoreCalculationsAreDeterministic();
  console.log("contextPolicy tests passed");
}

function testPassiveModeIsSilent() {
  const result = evaluateContextPolicy({
    manifest: manifest({ contentMode: "PASSIVE" }),
    segment: segment(),
    profile: profile()
  });

  equal(result.decision, "SILENT");
  includes(result.reasonCodes, "PASSIVE_CONTENT");
}

function testNoContextRequiredIsSilent() {
  const result = evaluateContextPolicy({
    manifest: manifest({ status: "NO_CONTEXT_REQUIRED", contentMode: "LEARNING" }),
    segment: segment(),
    profile: profile()
  });

  equal(result.decision, "SILENT");
  includes(result.reasonCodes, "NO_CONTEXT_REQUIRED");
}

function testUnknownCoreLearningShows() {
  const result = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: segment({ importance: "CORE" }),
    profile: profile()
  });

  equal(result.decision, "SHOW");
  equal(result.gapScore, 6);
  includes(result.reasonCodes, "UNKNOWN_CORE_CONCEPT");
  includes(result.reasonCodes, "LEARNING_THRESHOLD_MET");
}

function testComfortableHighConceptIsSilent() {
  const result = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: segment({ concept: "Docker", importance: "HIGH" }),
    profile: profile({
      "docker": {
        canonicalName: "Docker",
        state: "COMFORTABLE",
        confidence: 0.9,
        lastSeenAt: 100,
        evidenceCount: 1,
        source: "USER_EXPLICIT"
      }
    })
  });

  equal(result.decision, "SILENT");
  includes(result.reasonCodes, "VIEWER_ALREADY_COMFORTABLE");
}

function testUnknownPrerequisiteRaisesGapScore() {
  const base = segment({ concept: "Pods", importance: "MEDIUM", prerequisites: [] });
  const withPrerequisite = segment({ concept: "Pods", importance: "MEDIUM", prerequisites: ["Containers"] });

  const baseDelta = calculateKnowledgeDelta(base, profile());
  const prerequisiteDelta = calculateKnowledgeDelta(withPrerequisite, profile());

  equal(baseDelta.gapScore, 4);
  equal(prerequisiteDelta.gapScore, 6);
  equal(prerequisiteDelta.missingPrerequisites[0]?.canonicalName, "Containers");
}

function testContextualModeIsStricterThanLearningMode() {
  const currentSegment = segment({ concept: "Services", importance: "MEDIUM", prerequisites: [] });
  const learning = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: currentSegment,
    profile: profile()
  });
  const contextual = evaluateContextPolicy({
    manifest: manifest({ contentMode: "CONTEXTUAL" }),
    segment: currentSegment,
    profile: profile()
  });

  equal(learning.gapScore, 4);
  equal(learning.decision, "SHOW");
  equal(contextual.gapScore, 4);
  equal(contextual.decision, "SILENT");
  includes(contextual.reasonCodes, "CONTEXTUAL_THRESHOLD_NOT_MET");
}

function testMissingConceptEntryIsUnknown() {
  const result = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: segment({ concept: "Deployments", importance: "LOW" }),
    profile: profile()
  });

  equal(result.delta.primaryConcept?.knowledgeState, "UNKNOWN");
}

async function testKnownClickChangesPolicyFromShowToSilent() {
  const storage = createMemoryStorage();
  const currentSegment = segment({ concept: "etcd", importance: "CORE", prerequisites: [] });
  const before = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: currentSegment,
    profile: await getProfile(storage)
  });

  await markConceptKnown(currentSegment, storage, 1000);

  const after = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: currentSegment,
    profile: await getProfile(storage)
  });

  equal(before.decision, "SHOW");
  equal(after.decision, "SILENT");
  equal(after.delta.primaryConcept?.knowledgeState, "COMFORTABLE");
}

async function testSameCanonicalConceptAcrossVideosIsRemembered() {
  const storage = createMemoryStorage();
  await markConceptKnown(segment({ concept: "Kubernetes Pod" }), storage, 1000);

  const nextVideoSegment = segment({ concept: "Kubernetes Pods", importance: "CORE" });
  const result = evaluateContextPolicy({
    manifest: manifest({ videoId: "other-video", contentMode: "LEARNING" }),
    segment: nextVideoSegment,
    profile: await getProfile(storage)
  });

  equal(result.delta.primaryConcept?.knowledgeState, "COMFORTABLE");
  equal(result.decision, "SILENT");
}

function testNoMeaningfulConceptIsSilent() {
  const result = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: segment({ title: "   ", concept: "   ", concepts: [] }),
    profile: profile()
  });

  equal(result.decision, "SILENT");
  includes(result.reasonCodes, "NO_MEANINGFUL_CONCEPT");
}

function testFailedAnalysisIsErrorReasonNotViewerKnowledge() {
  const result = evaluateContextPolicy({
    manifest: manifest({ status: "FAILED", contentMode: "LEARNING" }),
    segment: segment(),
    profile: profile()
  });

  equal(result.decision, "SILENT");
  includes(result.reasonCodes, "ANALYSIS_FAILED");
  equal(result.reasonCodes.includes("VIEWER_ALREADY_COMFORTABLE"), false);
}

function testScoreCalculationsAreDeterministic() {
  const currentSegment = segment({ concept: "Pods", importance: "CORE", prerequisites: ["Containers", "Docker"] });
  const viewerProfile = profile({
    "container": {
      canonicalName: "Containers",
      state: "LEARNING",
      confidence: 0.4,
      lastSeenAt: 100,
      evidenceCount: 1,
      source: "SYSTEM_INFERRED"
    }
  });

  const first = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: currentSegment,
    profile: viewerProfile
  });
  const second = evaluateContextPolicy({
    manifest: manifest({ contentMode: "LEARNING" }),
    segment: currentSegment,
    profile: viewerProfile
  });

  equal(first.gapScore, 9);
  deepEqual(first, second);
}

function manifest(overrides: Partial<ContextManifest> = {}): ContextManifest {
  return {
    videoId: "video-1",
    title: "Kubernetes Tutorial",
    contentMode: "LEARNING",
    contextValue: "HIGH",
    status: "READY",
    modelVersion: "test",
    generatedAt: "2026-09-25T00:00:00.000Z",
    segments: [],
    ...overrides
  };
}

function segment(overrides: Partial<ConceptSegment> = {}): ConceptSegment {
  const conceptName = overrides.concept ?? "Pods";
  const title = overrides.title ?? conceptName;
  const concepts = overrides.concepts ?? [
    {
      name: conceptName,
      canonicalName: conceptName,
      description: "A Kubernetes concept."
    }
  ];

  return {
    id: String(title).trim().toLowerCase().replaceAll(" ", "-") || "blank",
    title,
    concept: conceptName,
    description: "A focused explanation.",
    startSeconds: 0,
    endSeconds: 60,
    difficulty: "BEGINNER",
    importance: "CORE",
    concepts,
    prerequisites: [],
    relatedConcepts: [],
    ...overrides
  };
}

function profile(concepts: LocalContextProfile["concepts"] = {}): LocalContextProfile {
  return {
    schemaVersion: 2,
    goal: "UNDERSTAND",
    concepts
  };
}

run().catch((error) => {
  console.error(error);
  throw error;
});

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function includes<T>(values: T[], expected: T) {
  if (!values.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(values)} to include ${String(expected)}`);
  }
}

function deepEqual(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}
