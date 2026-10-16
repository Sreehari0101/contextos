export type ProcessingStatus = "ANALYZING" | "READY" | "NO_CONTEXT_REQUIRED" | "FAILED";
export type ContentMode = "LEARNING" | "CONTEXTUAL" | "PASSIVE";
export type ContextValue = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type ContextReason =
  | "CONTEXT_AVAILABLE"
  | "NO_CONTEXT_REQUIRED"
  | "NO_SEGMENT_AT_TIMESTAMP"
  | "ANALYSIS_NOT_READY"
  | "ANALYSIS_FAILED";

export type Concept = {
  name: string;
  canonicalName: string;
  description: string;
  aliases?: string[];
};

export type ConceptSegment = {
  id: string;
  title: string;
  concept: string;
  description: string;
  startSeconds: number;
  endSeconds: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  importance: "LOW" | "MEDIUM" | "HIGH" | "CORE";
  concepts: Concept[];
  prerequisites: string[];
  relatedConcepts: string[];
};

export type ContextManifest = {
  videoId: string;
  title: string;
  contentMode: ContentMode;
  contextValue: ContextValue;
  status: ProcessingStatus;
  modelVersion: string;
  generatedAt: string;
  segments: ConceptSegment[];
};

export type ContextDecision = {
  videoId: string;
  timestampSeconds: number;
  status: ProcessingStatus;
  contextAvailable: boolean;
  reason: ContextReason;
  contentMode: ContentMode | null;
  contextValue: ContextValue | null;
  shouldShow: boolean;
  contextScore: number;
  segment: ConceptSegment | null;
  reasons: string[];
  explanation: string | null;
};

export type BridgeVariant = "DEFAULT" | "SIMPLER" | "REPAIR";
export type BridgeGoal = "UNDERSTAND" | "INTERVIEW" | "BUILD";

export type KnownAnchor = {
  concept: string;
  state: "FAMILIAR" | "COMFORTABLE";
};

export type BridgeRequest = {
  videoId: string;
  segmentId: string;
  primaryConcept: string;
  conceptDescription: string;
  segmentTitle: string;
  segmentDescription: string;
  importance: ConceptSegment["importance"];
  prerequisites: string[];
  knownAnchors: KnownAnchor[];
  variant: BridgeVariant;
  goal: BridgeGoal;
};

export type BridgeResponse = {
  concept: string;
  explanation: string;
  personalized: boolean;
  anchorUsed: string | null;
};
