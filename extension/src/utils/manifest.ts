import type { ConceptSegment, ContextManifest } from "../types/api";

export function findCurrentSegment(manifest: ContextManifest | null, currentTimeSeconds: number | null): ConceptSegment | null {
  if (!manifest || currentTimeSeconds === null || manifest.status !== "READY") {
    return null;
  }

  const timestamp = Math.max(0, Math.floor(currentTimeSeconds));
  return manifest.segments.find((segment) => timestamp >= segment.startSeconds && timestamp < segment.endSeconds) ?? null;
}
