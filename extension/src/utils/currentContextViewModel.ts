import type { ConceptSegment, ContextManifest } from "../types/api";
import { getConceptKey, getConceptKnowledgeFromProfile, type LocalContextProfile, type KnowledgeState } from "../services/profileStorage";
import { evaluateContextPolicy, type ContextPolicyResult } from "./contextPolicy";
import { findCurrentSegment } from "./manifest";

export type CurrentContextStatus = "NO_VIDEO" | "ANALYZING" | "ACTIVE" | "QUIET" | "FAILED";

export type CurrentContextViewModel = {
  timestamp: number | null;
  title: string;
  explanation: string;
  primaryConcept: string | null;
  importance: ConceptSegment["importance"] | null;
  knowledgeState: KnowledgeState;
  status: CurrentContextStatus;
  segment: ConceptSegment | null;
  conceptKey: string | null;
  policy: ContextPolicyResult;
};

export function createCurrentContextViewModel({
  manifest,
  profile,
  timestampSeconds,
  apiStatus,
  apiError,
  hasVideo
}: {
  manifest: ContextManifest | null;
  profile: LocalContextProfile | null;
  timestampSeconds: number | null;
  apiStatus: "idle" | "analyzing" | "ready" | "error";
  apiError: string | null;
  hasVideo: boolean;
}): CurrentContextViewModel {
  const segment = findCurrentSegment(manifest, timestampSeconds);
  const conceptKey = segment ? getConceptKey(segment) : null;
  const knowledgeState = segment ? getConceptKnowledgeFromProfile(segment, profile)?.state ?? "UNKNOWN" : "UNKNOWN";
  const policy = evaluateContextPolicy({ manifest, segment, profile });

  if (apiStatus === "error" || manifest?.status === "FAILED") {
    return {
      timestamp: timestampSeconds,
      title: "Context isn't available right now.",
      explanation: apiError ?? "ContextOS could not load a usable Context Manifest for this video.",
      primaryConcept: null,
      importance: null,
      knowledgeState,
      status: "FAILED",
      segment: null,
      conceptKey: null,
      policy
    };
  }

  if (apiStatus === "analyzing") {
    return {
      timestamp: timestampSeconds,
      title: "Analyzing this video...",
      explanation: "ContextOS is creating or loading the Context Manifest once.",
      primaryConcept: null,
      importance: null,
      knowledgeState,
      status: "ANALYZING",
      segment: null,
      conceptKey: null,
      policy
    };
  }

  if (!hasVideo) {
    return {
      timestamp: timestampSeconds,
      title: "Open a YouTube video",
      explanation: "Open a YouTube watch page, then use the extension icon to bring ContextOS beside the video.",
      primaryConcept: null,
      importance: null,
      knowledgeState,
      status: "NO_VIDEO",
      segment: null,
      conceptKey: null,
      policy
    };
  }

  if (manifest?.status === "NO_CONTEXT_REQUIRED" || policy.decision === "SILENT") {
    return {
      timestamp: timestampSeconds,
      title: "No extra context needed.",
      explanation: "You likely already have enough context for this part of the video.",
      primaryConcept: null,
      importance: null,
      knowledgeState,
      status: "QUIET",
      segment,
      conceptKey,
      policy
    };
  }

  if (segment && policy.decision === "SHOW") {
    return {
      timestamp: timestampSeconds,
      title: segment.concept,
      explanation: segment.description,
      primaryConcept: segment.concept,
      importance: segment.importance,
      knowledgeState,
      status: "ACTIVE",
      segment,
      conceptKey,
      policy
    };
  }

  return {
    timestamp: timestampSeconds,
    title: "YouTube video detected",
    explanation: "ContextOS is waiting for a useful concept at the current timestamp.",
    primaryConcept: null,
    importance: null,
    knowledgeState,
    status: "QUIET",
    segment: null,
    conceptKey: null,
    policy
  };
}
