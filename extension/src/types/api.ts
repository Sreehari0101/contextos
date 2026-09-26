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
