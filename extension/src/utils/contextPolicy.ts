import { getCanonicalName, getConceptKey, getConceptKnowledgeFromProfile, type KnowledgeState, type LocalContextProfile } from "../services/profileStorage";
import type { Concept, ConceptSegment, ContextManifest } from "../types/api";

export type ConceptDeltaRole = "PRIMARY" | "PREREQUISITE";
export type ContextPolicyDecision = "SHOW" | "SILENT";
export type ContextPolicyReason =
  | "PASSIVE_CONTENT"
  | "NO_CONTEXT_REQUIRED"
  | "ANALYSIS_FAILED"
  | "NO_MEANINGFUL_CONCEPT"
  | "VIEWER_ALREADY_COMFORTABLE"
  | "LOW_KNOWLEDGE_GAP"
  | "UNKNOWN_CORE_CONCEPT"
  | "UNKNOWN_HIGH_IMPORTANCE_CONCEPT"
  | "MISSING_PREREQUISITE"
  | "CONTEXTUAL_THRESHOLD_NOT_MET"
  | "CONTEXTUAL_THRESHOLD_MET"
  | "LEARNING_THRESHOLD_MET";

export type ConceptDelta = {
  canonicalName: string;
  knowledgeState: KnowledgeState;
  confidence: number;
  role: ConceptDeltaRole;
};

export type KnowledgeDelta = {
  primaryConcept: ConceptDelta | null;
  missingPrerequisites: ConceptDelta[];
  gapScore: number;
};

export type ContextPolicyResult = {
  decision: ContextPolicyDecision;
  gapScore: number;
  primaryConcept?: string;
  missingPrerequisites: string[];
  reasonCodes: ContextPolicyReason[];
  delta: KnowledgeDelta;
};

export const KNOWLEDGE_GAP_WEIGHTS: Record<KnowledgeState, number> = {
  UNKNOWN: 3,
  LEARNING: 2,
  FAMILIAR: 1,
  COMFORTABLE: 0
};

export const IMPORTANCE_WEIGHTS: Record<ConceptSegment["importance"], number> = {
  CORE: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0
};

export const POLICY_THRESHOLDS = {
  LEARNING: 4,
  CONTEXTUAL: 6
} as const;

export function evaluateContextPolicy({
  manifest,
  segment,
  profile
}: {
  manifest: ContextManifest | null;
  segment: ConceptSegment | null;
  profile: LocalContextProfile | null;
}): ContextPolicyResult {
  if (!manifest || manifest.status === "NO_CONTEXT_REQUIRED") {
    return silent("NO_CONTEXT_REQUIRED");
  }

  if (manifest.status === "FAILED") {
    return silent("ANALYSIS_FAILED");
  }

  if (manifest.contentMode === "PASSIVE") {
    return silent("PASSIVE_CONTENT");
  }

  if (!segment) {
    return silent("NO_MEANINGFUL_CONCEPT");
  }

  const delta = calculateKnowledgeDelta(segment, profile);
  const primaryConcept = delta.primaryConcept;

  if (!primaryConcept) {
    return silent("NO_MEANINGFUL_CONCEPT", delta);
  }

  const reasons: ContextPolicyReason[] = [];
  const missingPrerequisites = delta.missingPrerequisites.map((concept) => concept.canonicalName);

  if (primaryConcept.knowledgeState === "COMFORTABLE" && delta.missingPrerequisites.length === 0) {
    return {
      decision: "SILENT",
      gapScore: delta.gapScore,
      primaryConcept: primaryConcept.canonicalName,
      missingPrerequisites,
      reasonCodes: ["VIEWER_ALREADY_COMFORTABLE"],
      delta
    };
  }

  if (primaryConcept.knowledgeState === "UNKNOWN" && segment.importance === "CORE") {
    reasons.push("UNKNOWN_CORE_CONCEPT");
  }

  if (primaryConcept.knowledgeState === "UNKNOWN" && segment.importance === "HIGH") {
    reasons.push("UNKNOWN_HIGH_IMPORTANCE_CONCEPT");
  }

  if (delta.missingPrerequisites.length > 0) {
    reasons.push("MISSING_PREREQUISITE");
  }

  const threshold = manifest.contentMode === "CONTEXTUAL" ? POLICY_THRESHOLDS.CONTEXTUAL : POLICY_THRESHOLDS.LEARNING;
  const meetsThreshold = delta.gapScore >= threshold;

  if (manifest.contentMode === "CONTEXTUAL") {
    reasons.push(meetsThreshold ? "CONTEXTUAL_THRESHOLD_MET" : "CONTEXTUAL_THRESHOLD_NOT_MET");
  } else if (meetsThreshold) {
    reasons.push("LEARNING_THRESHOLD_MET");
  }

  if (!meetsThreshold) {
    reasons.push("LOW_KNOWLEDGE_GAP");
  }

  return {
    decision: meetsThreshold ? "SHOW" : "SILENT",
    gapScore: delta.gapScore,
    primaryConcept: primaryConcept.canonicalName,
    missingPrerequisites,
    reasonCodes: uniqueReasons(reasons),
    delta
  };
}

export function calculateKnowledgeDelta(segment: ConceptSegment, profile: LocalContextProfile | null): KnowledgeDelta {
  const primaryConcept = getPrimaryConcept(segment);
  if (!primaryConcept) {
    return {
      primaryConcept: null,
      missingPrerequisites: [],
      gapScore: 0
    };
  }

  const primaryDelta = toConceptDelta(primaryConcept, "PRIMARY", profile);
  const missingPrerequisites = segment.prerequisites
      .map((prerequisite) => toConceptDelta(prerequisite, "PREREQUISITE", profile))
      .filter((delta) => delta.knowledgeState === "UNKNOWN" || delta.knowledgeState === "LEARNING");

  const prerequisitePenalty = missingPrerequisites.reduce((total, prerequisite) => {
    if (prerequisite.knowledgeState === "UNKNOWN") {
      return total + 2;
    }
    if (prerequisite.knowledgeState === "LEARNING") {
      return total + 1;
    }
    return total;
  }, 0);

  const gapScore =
    KNOWLEDGE_GAP_WEIGHTS[primaryDelta.knowledgeState] +
    IMPORTANCE_WEIGHTS[segment.importance] +
    prerequisitePenalty;

  return {
    primaryConcept: primaryDelta,
    missingPrerequisites,
    gapScore
  };
}

export function getPrimaryConcept(segment: ConceptSegment): Concept | string | null {
  const firstMeaningfulConcept = segment.concepts.find((concept) => getConceptKey(concept));
  if (firstMeaningfulConcept) {
    return firstMeaningfulConcept;
  }

  if (getConceptKey(segment.concept)) {
    return segment.concept;
  }

  if (getConceptKey(segment.title)) {
    return segment.title;
  }

  return null;
}

function toConceptDelta(
  concept: Concept | string,
  role: ConceptDeltaRole,
  profile: LocalContextProfile | null
): ConceptDelta {
  const canonicalName = getCanonicalName(concept);
  const knowledge = getConceptKnowledgeFromProfile(concept, profile);
  return {
    canonicalName,
    knowledgeState: knowledge?.state ?? "UNKNOWN",
    confidence: knowledge?.confidence ?? 0,
    role
  };
}

function silent(reason: ContextPolicyReason, delta: KnowledgeDelta = emptyDelta()): ContextPolicyResult {
  return {
    decision: "SILENT",
    gapScore: delta.gapScore,
    primaryConcept: delta.primaryConcept?.canonicalName,
    missingPrerequisites: delta.missingPrerequisites.map((concept) => concept.canonicalName),
    reasonCodes: [reason],
    delta
  };
}

function emptyDelta(): KnowledgeDelta {
  return {
    primaryConcept: null,
    missingPrerequisites: [],
    gapScore: 0
  };
}

function uniqueReasons(reasons: ContextPolicyReason[]): ContextPolicyReason[] {
  return [...new Set(reasons)];
}
