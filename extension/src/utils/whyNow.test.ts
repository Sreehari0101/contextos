import { getWhyNowReasons, shouldShowWhyNow } from "./whyNow";
import type { LocalContextProfile } from "../services/profileStorage";
import type { ContextPolicyResult } from "./contextPolicy";

function run() {
  testUnknownCoreReason();
  testMissingPrerequisiteReasonUsesPolicyDelta();
  testContextualReason();
  testMaximumTwoReasons();
  testPersonalizedBridgeAddsAnchorReason();
  testNonPersonalizedBridgeDoesNotClaimAnchor();
  testShouldNotShowWhyNowForSilentOrPassive();
  testUnknownReasonFailsGracefully();
  testSilentReasonsDoNotInventExplanations();
  console.log("whyNow tests passed");
}

function testUnknownCoreReason() {
  const reasons = getWhyNowReasons({
    policy: policy(["UNKNOWN_CORE_CONCEPT", "LEARNING_THRESHOLD_MET"]),
    contentMode: "LEARNING",
    knowledgeState: "UNKNOWN"
  });

  equal(reasons[0], "This is an important concept in the current section, and you haven't marked it as known yet.");
}

function testMissingPrerequisiteReasonUsesPolicyDelta() {
  const reasons = getWhyNowReasons({
    policy: policy(["MISSING_PREREQUISITE", "LEARNING_THRESHOLD_MET"], ["Containers"]),
    contentMode: "LEARNING",
    knowledgeState: "LEARNING"
  });

  equal(reasons[0], "This section depends on Containers, which may still need reinforcement.");
}

function testContextualReason() {
  const reasons = getWhyNowReasons({
    policy: policy(["CONTEXTUAL_THRESHOLD_MET"]),
    contentMode: "CONTEXTUAL",
    knowledgeState: "UNKNOWN"
  });

  equal(reasons[0], "This reference adds useful background for the current section.");
}

function testMaximumTwoReasons() {
  const reasons = getWhyNowReasons({
    policy: policy(["UNKNOWN_CORE_CONCEPT", "MISSING_PREREQUISITE", "LEARNING_THRESHOLD_MET"], ["Containers"]),
    contentMode: "LEARNING",
    knowledgeState: "UNKNOWN"
  });

  equal(reasons.length, 2);
}

function testPersonalizedBridgeAddsAnchorReason() {
  const reasons = getWhyNowReasons({
    policy: policy(["UNKNOWN_CORE_CONCEPT", "MISSING_PREREQUISITE", "LEARNING_THRESHOLD_MET"], ["Containers"]),
    contentMode: "LEARNING",
    knowledgeState: "UNKNOWN",
    bridgeResponse: {
      concept: "etcd",
      explanation: "Think of etcd as Kubernetes' source-of-truth database.",
      personalized: true,
      anchorUsed: "Database"
    },
    profile: profile({
      database: {
        canonicalName: "Database",
        state: "COMFORTABLE",
        confidence: 0.9,
        lastSeenAt: 1,
        evidenceCount: 1,
        source: "USER_EXPLICIT"
      }
    })
  });

  equal(reasons.length, 3);
  equal(reasons[2], "I connected this explanation to Database because it is something you're comfortable with.");
}

function testNonPersonalizedBridgeDoesNotClaimAnchor() {
  const reasons = getWhyNowReasons({
    policy: policy(["UNKNOWN_CORE_CONCEPT"]),
    contentMode: "LEARNING",
    knowledgeState: "UNKNOWN",
    bridgeResponse: {
      concept: "etcd",
      explanation: "Generic explanation.",
      personalized: false,
      anchorUsed: "Database"
    },
    profile: profile()
  });

  equal(reasons.length, 1);
}

function testShouldNotShowWhyNowForSilentOrPassive() {
  equal(shouldShowWhyNow({ policyDecision: "SILENT", contentMode: "LEARNING" }), false);
  equal(shouldShowWhyNow({ policyDecision: "SHOW", contentMode: "PASSIVE" }), false);
  equal(shouldShowWhyNow({ policyDecision: "SHOW", contentMode: "LEARNING" }), true);
}

function testUnknownReasonFailsGracefully() {
  const reasons = getWhyNowReasons({
    policy: policy(["UNKNOWN_REASON" as ContextPolicyResult["reasonCodes"][number]]),
    contentMode: "LEARNING",
    knowledgeState: "UNKNOWN"
  });

  equal(reasons.length, 0);
}

function testSilentReasonsDoNotInventExplanations() {
  const reasons = getWhyNowReasons({
    policy: policy(["VIEWER_ALREADY_COMFORTABLE", "LOW_KNOWLEDGE_GAP"]),
    contentMode: "LEARNING",
    knowledgeState: "COMFORTABLE"
  });

  equal(reasons.length, 0);
}

function policy(reasonCodes: ContextPolicyResult["reasonCodes"], missingPrerequisites: string[] = []): ContextPolicyResult {
  return {
    decision: "SHOW",
    gapScore: 6,
    primaryConcept: "Pods",
    missingPrerequisites,
    reasonCodes,
    delta: {
      primaryConcept: null,
      missingPrerequisites: [],
      gapScore: 6
    }
  };
}

function profile(concepts: LocalContextProfile["concepts"] = {}): LocalContextProfile {
  return {
    schemaVersion: 2,
    goal: "UNDERSTAND",
    concepts
  };
}

run();

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}
