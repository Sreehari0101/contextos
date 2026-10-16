import type { KnowledgeState } from "../services/profileStorage";
import { getConceptKey, type LocalContextProfile } from "../services/profileStorage";
import type { BridgeResponse, ContextManifest } from "../types/api";
import type { ContextPolicyDecision, ContextPolicyReason, ContextPolicyResult } from "./contextPolicy";

const MAX_REASONS = 2;

export function getWhyNowReasons({
  policy,
  contentMode,
  knowledgeState,
  bridgeResponse,
  profile
}: {
  policy: ContextPolicyResult;
  contentMode: ContextManifest["contentMode"];
  knowledgeState: KnowledgeState;
  bridgeResponse?: BridgeResponse | null;
  profile?: LocalContextProfile | null;
}): string[] {
  const mapped = prioritizedReasons(policy.reasonCodes)
      .map((reason) => toUserFacingReason(reason, contentMode, knowledgeState, policy.missingPrerequisites))
      .filter((reason): reason is string => Boolean(reason));

  const primaryReasons = unique(mapped).slice(0, MAX_REASONS);
  const anchorReason = anchorTransparencyReason(bridgeResponse, profile);
  return anchorReason ? [...primaryReasons, anchorReason] : primaryReasons;
}

export function shouldShowWhyNow({
  policyDecision,
  contentMode
}: {
  policyDecision: ContextPolicyDecision;
  contentMode: ContextManifest["contentMode"];
}): boolean {
  return policyDecision === "SHOW" && contentMode !== "PASSIVE";
}

function prioritizedReasons(reasons: ContextPolicyReason[]): ContextPolicyReason[] {
  const priority: ContextPolicyReason[] = [
    "UNKNOWN_CORE_CONCEPT",
    "UNKNOWN_HIGH_IMPORTANCE_CONCEPT",
    "MISSING_PREREQUISITE",
    "CONTEXTUAL_THRESHOLD_MET",
    "LEARNING_THRESHOLD_MET",
    "LOW_KNOWLEDGE_GAP",
    "CONTEXTUAL_THRESHOLD_NOT_MET",
    "VIEWER_ALREADY_COMFORTABLE",
    "PASSIVE_CONTENT",
    "NO_CONTEXT_REQUIRED",
    "ANALYSIS_FAILED",
    "NO_MEANINGFUL_CONCEPT"
  ];

  return priority.filter((reason) => reasons.includes(reason));
}

function toUserFacingReason(
  reason: ContextPolicyReason,
  contentMode: ContextManifest["contentMode"],
  knowledgeState: KnowledgeState,
  missingPrerequisites: string[]
): string | null {
  switch (reason) {
    case "UNKNOWN_CORE_CONCEPT":
      return knowledgeState === "UNKNOWN"
          ? "This is an important concept in the current section, and you haven't marked it as known yet."
          : "This is an important concept in the current section.";
    case "UNKNOWN_HIGH_IMPORTANCE_CONCEPT":
      return "This concept is important for following what comes next.";
    case "MISSING_PREREQUISITE":
      return missingPrerequisites.length > 0
          ? `This section depends on ${missingPrerequisites[0]}, which may still need reinforcement.`
          : "This section depends on a prerequisite you may not know yet.";
    case "CONTEXTUAL_THRESHOLD_MET":
      return "This reference adds useful background for the current section.";
    case "LEARNING_THRESHOLD_MET":
      return contentMode === "LEARNING"
          ? "The current section has enough learning value to justify a short explanation."
          : "The policy score passed the threshold for this section.";
    case "LOW_KNOWLEDGE_GAP":
    case "CONTEXTUAL_THRESHOLD_NOT_MET":
    case "VIEWER_ALREADY_COMFORTABLE":
    case "PASSIVE_CONTENT":
    case "NO_CONTEXT_REQUIRED":
    case "ANALYSIS_FAILED":
    case "NO_MEANINGFUL_CONCEPT":
      return null;
  }
}

function anchorTransparencyReason(
  bridgeResponse: BridgeResponse | null | undefined,
  profile: LocalContextProfile | null | undefined
): string | null {
  if (!bridgeResponse?.personalized || !bridgeResponse.anchorUsed) {
    return null;
  }

  const knowledge = profile?.concepts[getConceptKey(bridgeResponse.anchorUsed)];
  const comfort = knowledge?.state === "COMFORTABLE" ? "comfortable with" : "familiar with";
  return `I connected this explanation to ${bridgeResponse.anchorUsed} because it is something you're ${comfort}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
