import { getCanonicalName, getConceptKey, getConceptKnowledgeFromProfile, type LocalContextProfile } from "./profileStorage";
import type { BridgeGoal, BridgeRequest, BridgeResponse, BridgeVariant, ConceptSegment, KnownAnchor } from "../types/api";
import type { ContextPolicyDecision } from "../utils/contextPolicy";

export type BridgeEligibility = {
  videoId: string | null;
  segment: ConceptSegment | null;
  conceptKey: string | null;
  policyDecision: ContextPolicyDecision;
};

export type BridgeRequestInput = {
  videoId: string;
  segment: ConceptSegment;
  conceptKey: string;
  profile: LocalContextProfile | null;
  variant: BridgeVariant;
  goal: BridgeGoal;
};

export function shouldRequestBridge(input: BridgeEligibility): boolean {
  return Boolean(
      input.videoId &&
      input.segment &&
      input.conceptKey &&
      input.policyDecision === "SHOW"
  );
}

export function buildBridgeRequest(input: BridgeRequestInput): BridgeRequest {
  const primaryConcept = getCanonicalName(input.segment);
  return {
    videoId: input.videoId,
    segmentId: input.segment.id,
    primaryConcept,
    conceptDescription: input.segment.concepts[0]?.description ?? "",
    segmentTitle: input.segment.title,
    segmentDescription: input.segment.description,
    importance: input.segment.importance,
    prerequisites: input.segment.prerequisites,
    knownAnchors: selectKnownAnchors(input.profile, input.segment),
    variant: input.variant,
    goal: input.goal
  };
}

export function selectKnownAnchors(profile: LocalContextProfile | null, segment: ConceptSegment, maxAnchors = 3): KnownAnchor[] {
  if (!profile) {
    return [];
  }

  const anchors: KnownAnchor[] = [];
  const used = new Set<string>();
  const addAnchor = (concept: string, state: KnownAnchor["state"]) => {
    const key = getConceptKey(concept);
    if (!key || used.has(key) || anchors.length >= maxAnchors) {
      return;
    }
    used.add(key);
    anchors.push({ concept, state });
  };

  for (const prerequisite of segment.prerequisites) {
    const knowledge = getConceptKnowledgeFromProfile(prerequisite, profile);
    if (knowledge?.state === "COMFORTABLE") {
      addAnchor(knowledge.canonicalName, "COMFORTABLE");
    }
  }

  for (const prerequisite of segment.prerequisites) {
    const knowledge = getConceptKnowledgeFromProfile(prerequisite, profile);
    if (knowledge?.state === "FAMILIAR") {
      addAnchor(knowledge.canonicalName, "FAMILIAR");
    }
  }

  const recentKnown = Object.values(profile.concepts)
      .filter((concept) => concept.state === "COMFORTABLE" || concept.state === "FAMILIAR")
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  for (const concept of recentKnown) {
    if (concept.state === "COMFORTABLE" || concept.state === "FAMILIAR") {
      addAnchor(concept.canonicalName, concept.state);
    }
  }

  return anchors;
}

export function createBridgeCacheKey(request: BridgeRequest, conceptKey: string): string {
  const anchorKeys = request.knownAnchors
      .map((anchor) => getConceptKey(anchor.concept))
      .filter(Boolean)
      .sort()
      .join(",");
  return [
    request.videoId,
    request.segmentId,
    conceptKey,
    request.variant,
    request.goal,
    anchorKeys
  ].join(":");
}

export function shouldSkipDuplicateBridgeRequest(cacheKey: string, inFlightKey: string | null): boolean {
  return cacheKey === inFlightKey;
}

export function fallbackBridgeResponse(segment: ConceptSegment): BridgeResponse {
  return {
    concept: getCanonicalName(segment),
    explanation: segment.description,
    personalized: false,
    anchorUsed: null
  };
}

export function isStaleBridgeResponse(startedKey: string, currentKey: string | null): boolean {
  return startedKey !== currentKey;
}

export function bridgeResponseAfterFailure(previous: BridgeResponse | null, segment: ConceptSegment): BridgeResponse {
  return previous ?? fallbackBridgeResponse(segment);
}
