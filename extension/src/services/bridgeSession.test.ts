import {
  bridgeResponseAfterFailure,
  buildBridgeRequest,
  createBridgeCacheKey,
  fallbackBridgeResponse,
  isStaleBridgeResponse,
  selectKnownAnchors,
  shouldRequestBridge,
  shouldSkipDuplicateBridgeRequest
} from "./bridgeSession";
import { createMemoryStorage, getProfile, markConceptKnown, markConceptNeedsSimpler, type LocalContextProfile } from "./profileStorage";
import type { BridgeResponse, ConceptSegment, ContextManifest } from "../types/api";
import { evaluateContextPolicy } from "../utils/contextPolicy";

async function run() {
  testSilentPolicyDoesNotRequestBridge();
  testPassivePolicyDoesNotRequestBridge();
  testShowPolicyBuildsOneBridgeRequest();
  testBridgeRequestIncludesGoal();
  testSameSegmentRerenderCanSkipDuplicateRequest();
  testCacheKeyIncludesGoal();
  testCachedBridgeCanBeReused();
  testStaleResponseIsDetectedAfterSegmentChange();
  await testKnownClickStillTurnsShowSilent();
  await testSimplerUpdatesConceptToLearning();
  await testSimplerSendsSimplerVariant();
  testSimplerFailureKeepsPreviousExplanation();
  testGenericExplanationIsAvailableWhileBridgeLoads();
  testKnownAnchorSelectionPrefersRelevantSmallSet();
  console.log("bridgeSession tests passed");
}

function testSilentPolicyDoesNotRequestBridge() {
  equal(shouldRequestBridge({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    policyDecision: "SILENT"
  }), false);
}

function testPassivePolicyDoesNotRequestBridge() {
  const policy = evaluateContextPolicy({
    manifest: manifest({ contentMode: "PASSIVE" }),
    segment: segment(),
    profile: profile()
  });

  equal(policy.decision, "SILENT");
  equal(shouldRequestBridge({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    policyDecision: policy.decision
  }), false);
}

function testShowPolicyBuildsOneBridgeRequest() {
  const currentSegment = segment();
  const request = buildBridgeRequest({
    videoId: "video-1",
    segment: currentSegment,
    conceptKey: "etcd",
    profile: profile(),
    variant: "DEFAULT",
    goal: "UNDERSTAND"
  });

  equal(shouldRequestBridge({
    videoId: "video-1",
    segment: currentSegment,
    conceptKey: "etcd",
    policyDecision: "SHOW"
  }), true);
  equal(request.primaryConcept, "etcd");
  equal(request.variant, "DEFAULT");
}

function testBridgeRequestIncludesGoal() {
  const request = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: profile({}, "BUILD"),
    variant: "DEFAULT",
    goal: "BUILD"
  });

  equal(request.goal, "BUILD");
}

function testSameSegmentRerenderCanSkipDuplicateRequest() {
  const request = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: profile(),
    variant: "DEFAULT",
    goal: "UNDERSTAND"
  });
  const key = createBridgeCacheKey(request, "etcd");

  equal(shouldSkipDuplicateBridgeRequest(key, key), true);
}

function testCachedBridgeCanBeReused() {
  const request = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: profile(),
    variant: "DEFAULT",
    goal: "UNDERSTAND"
  });
  const key = createBridgeCacheKey(request, "etcd");
  const cache = new Map<string, BridgeResponse>();
  cache.set(key, { concept: "etcd", explanation: "cached", personalized: false, anchorUsed: null });

  equal(cache.get(key)?.explanation, "cached");
}

function testCacheKeyIncludesGoal() {
  const understand = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: profile({}, "UNDERSTAND"),
    variant: "DEFAULT",
    goal: "UNDERSTAND"
  });
  const build = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: profile({}, "BUILD"),
    variant: "DEFAULT",
    goal: "BUILD"
  });

  notEqual(createBridgeCacheKey(understand, "etcd"), createBridgeCacheKey(build, "etcd"));
}

function testStaleResponseIsDetectedAfterSegmentChange() {
  equal(isStaleBridgeResponse("video-1:segment-a:etcd:DEFAULT:", "video-1:segment-b:pod:DEFAULT:"), true);
}

async function testKnownClickStillTurnsShowSilent() {
  const storage = createMemoryStorage();
  const currentSegment = segment({ importance: "CORE" });
  const before = evaluateContextPolicy({
    manifest: manifest(),
    segment: currentSegment,
    profile: await getProfile(storage)
  });

  await markConceptKnown(currentSegment, storage, 1000);

  const after = evaluateContextPolicy({
    manifest: manifest(),
    segment: currentSegment,
    profile: await getProfile(storage)
  });

  equal(before.decision, "SHOW");
  equal(after.decision, "SILENT");
}

async function testSimplerUpdatesConceptToLearning() {
  const storage = createMemoryStorage();
  const nextProfile = await markConceptNeedsSimpler(segment(), storage, 1000);
  const knowledge = nextProfile.concepts["etcd"];

  equal(knowledge.state, "LEARNING");
  equal(knowledge.confidence, 0.3);
  equal(knowledge.source, "USER_EXPLICIT");
}

async function testSimplerSendsSimplerVariant() {
  const storage = createMemoryStorage();
  const nextProfile = await markConceptNeedsSimpler(segment(), storage, 1000);
  const request = buildBridgeRequest({
    videoId: "video-1",
    segment: segment(),
    conceptKey: "etcd",
    profile: nextProfile,
    variant: "SIMPLER",
    goal: nextProfile.goal
  });

  equal(request.variant, "SIMPLER");
  equal(request.goal, "UNDERSTAND");
}

function testSimplerFailureKeepsPreviousExplanation() {
  const previous: BridgeResponse = {
    concept: "etcd",
    explanation: "Previous explanation stays visible.",
    personalized: true,
    anchorUsed: "Database"
  };

  equal(bridgeResponseAfterFailure(previous, segment()).explanation, "Previous explanation stays visible.");
}

function testGenericExplanationIsAvailableWhileBridgeLoads() {
  equal(fallbackBridgeResponse(segment()).explanation, "etcd stores Kubernetes cluster state.");
}

function testKnownAnchorSelectionPrefersRelevantSmallSet() {
  const anchors = selectKnownAnchors(profile({
    database: {
      canonicalName: "Database",
      state: "COMFORTABLE",
      confidence: 0.9,
      lastSeenAt: 10,
      evidenceCount: 1,
      source: "USER_EXPLICIT"
    },
    java: {
      canonicalName: "Java",
      state: "COMFORTABLE",
      confidence: 0.9,
      lastSeenAt: 30,
      evidenceCount: 1,
      source: "USER_EXPLICIT"
    },
    "rest api": {
      canonicalName: "REST API",
      state: "FAMILIAR",
      confidence: 0.7,
      lastSeenAt: 20,
      evidenceCount: 1,
      source: "SYSTEM_INFERRED"
    },
    docker: {
      canonicalName: "Docker",
      state: "COMFORTABLE",
      confidence: 0.9,
      lastSeenAt: 40,
      evidenceCount: 1,
      source: "USER_EXPLICIT"
    }
  }), segment({ prerequisites: ["Database"] }));

  equal(anchors.length, 3);
  equal(anchors[0]?.concept, "Database");
}

function manifest(overrides: Partial<ContextManifest> = {}): ContextManifest {
  return {
    videoId: "video-1",
    title: "Kubernetes Tutorial",
    contentMode: "LEARNING",
    contextValue: "HIGH",
    status: "READY",
    modelVersion: "test",
    generatedAt: "2026-10-02T00:00:00.000Z",
    segments: [],
    ...overrides
  };
}

function segment(overrides: Partial<ConceptSegment> = {}): ConceptSegment {
  return {
    id: "segment-1",
    title: "etcd",
    concept: "etcd",
    description: "etcd stores Kubernetes cluster state.",
    startSeconds: 0,
    endSeconds: 60,
    difficulty: "BEGINNER",
    importance: "CORE",
    concepts: [
      {
        name: "etcd",
        canonicalName: "etcd",
        description: "A distributed key-value store."
      }
    ],
    prerequisites: [],
    relatedConcepts: [],
    ...overrides
  };
}

function profile(concepts: LocalContextProfile["concepts"] = {}, goal: LocalContextProfile["goal"] = "UNDERSTAND"): LocalContextProfile {
  return {
    schemaVersion: 2,
    goal,
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

function notEqual(actual: unknown, expected: unknown) {
  if (actual === expected) {
    throw new Error(`Expected ${String(actual)} not to equal ${String(expected)}`);
  }
}
