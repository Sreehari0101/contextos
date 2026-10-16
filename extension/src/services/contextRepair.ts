import {
  getCanonicalName,
  getConceptKey,
  getConceptKnowledgeFromProfile,
  resolveConceptIdentity,
  type KnowledgeState,
  type LocalContextProfile
} from "./profileStorage";
import type { BridgeGoal, BridgeRequest, ConceptSegment, ContextManifest, KnownAnchor } from "../types/api";
import { selectKnownAnchors } from "./bridgeSession";

export type RepairRelationship = "DIRECT_PREREQUISITE" | "INDIRECT_PREREQUISITE" | "CURRENT_CONCEPT";
export type RepairReason =
  | "UNKNOWN_DIRECT_PREREQUISITE"
  | "LEARNING_DIRECT_PREREQUISITE"
  | "UNKNOWN_INDIRECT_PREREQUISITE"
  | "LEARNING_INDIRECT_PREREQUISITE"
  | "CURRENT_CONCEPT_GAP"
  | "NO_CLEAR_PREREQUISITE";

export type RepairCandidate = {
  conceptKey: string;
  canonicalName: string;
  knowledgeState: KnowledgeState;
  confidence: number;
  relationship: RepairRelationship;
  earlierTimestamp?: number;
  reason: RepairReason;
};

export function diagnoseRepairCandidate({
  manifest,
  segment,
  profile,
  currentTimestamp
}: {
  manifest: ContextManifest | null;
  segment: ConceptSegment | null;
  profile: LocalContextProfile | null;
  currentTimestamp: number | null;
}): RepairCandidate | null {
  if (!manifest || !segment) {
    return null;
  }

  const direct = selectPrerequisite(segment.prerequisites, profile, "DIRECT_PREREQUISITE");
  if (direct) {
    return withEarlierTimestamp(direct, manifest, currentTimestamp);
  }

  const indirect = selectIndirectPrerequisite(manifest, segment, profile);
  if (indirect) {
    return withEarlierTimestamp(indirect, manifest, currentTimestamp);
  }

  const current = candidateForConcept(segment, profile, "CURRENT_CONCEPT");
  return withEarlierTimestamp({
    ...current,
    reason: current.knowledgeState === "COMFORTABLE" ? "NO_CLEAR_PREREQUISITE" : "CURRENT_CONCEPT_GAP"
  }, manifest, currentTimestamp);
}

export function buildRepairBridgeRequest({
  videoId,
  currentSegment,
  candidate,
  profile,
  goal
}: {
  videoId: string;
  currentSegment: ConceptSegment;
  candidate: RepairCandidate;
  profile: LocalContextProfile | null;
  goal: BridgeGoal;
}): BridgeRequest {
  const anchors: KnownAnchor[] = selectKnownAnchors(profile, currentSegment);
  return {
    videoId,
    segmentId: currentSegment.id,
    primaryConcept: candidate.canonicalName,
    conceptDescription: `${candidate.canonicalName} is background for understanding ${getCanonicalName(currentSegment)}.`,
    segmentTitle: currentSegment.title,
    segmentDescription: `Current concept: ${getCanonicalName(currentSegment)}. Current section: ${currentSegment.description}`,
    importance: currentSegment.importance,
    prerequisites: currentSegment.prerequisites,
    knownAnchors: anchors,
    variant: "REPAIR",
    goal
  };
}

function selectPrerequisite(
  prerequisites: string[],
  profile: LocalContextProfile | null,
  relationship: Extract<RepairRelationship, "DIRECT_PREREQUISITE" | "INDIRECT_PREREQUISITE">
): RepairCandidate | null {
  const candidates = prerequisites.map((prerequisite) => candidateForConcept(prerequisite, profile, relationship));
  return candidates.find((candidate) => candidate.knowledgeState === "UNKNOWN")
      ?? candidates.find((candidate) => candidate.knowledgeState === "LEARNING")
      ?? null;
}

function selectIndirectPrerequisite(
  manifest: ContextManifest,
  segment: ConceptSegment,
  profile: LocalContextProfile | null
): RepairCandidate | null {
  const visited = new Set<string>();
  for (const prerequisite of segment.prerequisites) {
    const key = getConceptKey(prerequisite);
    if (!key || visited.has(key)) {
      continue;
    }
    visited.add(key);
    const prerequisiteSegment = findSegmentForConcept(manifest, prerequisite);
    if (!prerequisiteSegment) {
      continue;
    }
    const indirect = selectPrerequisite(prerequisiteSegment.prerequisites, profile, "INDIRECT_PREREQUISITE");
    if (indirect) {
      return indirect;
    }
  }
  return null;
}

function candidateForConcept(
  concept: ConceptSegment | string,
  profile: LocalContextProfile | null,
  relationship: RepairRelationship
): RepairCandidate {
  const identity = resolveConceptIdentity(concept, profile);
  const knowledge = getConceptKnowledgeFromProfile(concept, profile);
  const knowledgeState = knowledge?.state ?? "UNKNOWN";
  return {
    conceptKey: identity.key,
    canonicalName: identity.canonicalName || getCanonicalName(concept),
    knowledgeState,
    confidence: knowledge?.confidence ?? 0,
    relationship,
    reason: reasonFor(relationship, knowledgeState)
  };
}

function reasonFor(relationship: RepairRelationship, state: KnowledgeState): RepairReason {
  if (relationship === "CURRENT_CONCEPT") {
    return "CURRENT_CONCEPT_GAP";
  }
  if (relationship === "DIRECT_PREREQUISITE") {
    return state === "LEARNING" ? "LEARNING_DIRECT_PREREQUISITE" : "UNKNOWN_DIRECT_PREREQUISITE";
  }
  return state === "LEARNING" ? "LEARNING_INDIRECT_PREREQUISITE" : "UNKNOWN_INDIRECT_PREREQUISITE";
}

function withEarlierTimestamp(
  candidate: RepairCandidate,
  manifest: ContextManifest,
  currentTimestamp: number | null
): RepairCandidate {
  const earlier = findEarlierTimestamp(manifest, candidate, currentTimestamp);
  return earlier === undefined ? candidate : { ...candidate, earlierTimestamp: earlier };
}

function findEarlierTimestamp(
  manifest: ContextManifest,
  candidate: RepairCandidate,
  currentTimestamp: number | null
): number | undefined {
  if (currentTimestamp === null) {
    return undefined;
  }

  return manifest.segments
      .filter((segment) => segment.startSeconds < currentTimestamp)
      .find((segment) => segmentMatchesConcept(segment, candidate.conceptKey))?.startSeconds;
}

function findSegmentForConcept(manifest: ContextManifest, concept: string): ConceptSegment | null {
  const conceptKey = getConceptKey(concept);
  return manifest.segments.find((segment) => segmentMatchesConcept(segment, conceptKey)) ?? null;
}

function segmentMatchesConcept(segment: ConceptSegment, conceptKey: string): boolean {
  const identity = resolveConceptIdentity(segment, null);
  if (identity.key === conceptKey || identity.aliases.map(getConceptKey).includes(conceptKey)) {
    return true;
  }
  return segment.concepts.some((concept) => {
    const conceptIdentity = resolveConceptIdentity(concept, null);
    return conceptIdentity.key === conceptKey || conceptIdentity.aliases.map(getConceptKey).includes(conceptKey);
  });
}
