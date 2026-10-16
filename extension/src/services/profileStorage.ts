import type { Concept, ConceptSegment } from "../types/api";

export type LocalGoal = "UNDERSTAND" | "INTERVIEW" | "BUILD";
export type KnowledgeState = "UNKNOWN" | "LEARNING" | "FAMILIAR" | "COMFORTABLE";
export type KnowledgeSource = "USER_EXPLICIT" | "SYSTEM_INFERRED";

export type ConceptKnowledge = {
  canonicalName: string;
  aliases?: string[];
  state: KnowledgeState;
  confidence: number;
  firstSeenAt?: number;
  lastSeenAt: number;
  evidenceCount: number;
  source?: KnowledgeSource;
};

export type LocalContextProfile = {
  schemaVersion: 2;
  goal: LocalGoal;
  concepts: Record<string, ConceptKnowledge>;
};

export type ConceptIdentity = {
  key: string;
  canonicalName: string;
  aliases: string[];
};

export type StorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove?(key: string): Promise<void>;
};

const PROFILE_STORAGE_KEY = "contextos.localProfile";
const SCHEMA_VERSION = 2;

export const DEFAULT_PROFILE: LocalContextProfile = {
  schemaVersion: SCHEMA_VERSION,
  goal: "UNDERSTAND",
  concepts: {}
};

export function getConceptKey(value: Concept | ConceptSegment | string | null | undefined): string {
  return normalizeConceptName(getCanonicalName(value));
}

export function getConceptAliases(value: Concept | ConceptSegment | string | null | undefined): string[] {
  if (!value || typeof value === "string") {
    return [];
  }

  if ("canonicalName" in value) {
    return normalizeAliasList(value.aliases);
  }

  return normalizeAliasList([
    value.concept,
    ...value.concepts.flatMap((concept) => [concept.name, ...(concept.aliases ?? [])])
  ]);
}

export function getCanonicalName(value: Concept | ConceptSegment | string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if ("canonicalName" in value) {
    return firstNonBlank(value.canonicalName, value.name);
  }

  const primaryConcept = value.concepts?.[0];
  return firstNonBlank(primaryConcept?.canonicalName, primaryConcept?.name, value.concept, value.title);
}

export function normalizeConceptName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/[^\w\s]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > 4 && normalized.endsWith("ies")) {
    return normalized.slice(0, -3) + "y";
  }
  if (normalized.length > 3 && normalized.endsWith("s") && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function resolveConceptIdentity(
  value: Concept | ConceptSegment | string | null | undefined,
  profile: LocalContextProfile | null = null
): ConceptIdentity {
  const canonicalName = getCanonicalName(value).trim();
  const aliases = getConceptAliases(value);
  const candidateKeys = uniqueStrings([
    normalizeConceptName(canonicalName),
    ...aliases.map(normalizeConceptName)
  ]).filter(Boolean);
  const existingKey = profile ? findExistingConceptKey(candidateKeys, profile) : "";
  const key = existingKey || candidateKeys[0] || "";
  const existing = key ? profile?.concepts[key] : undefined;

  return {
    key,
    canonicalName: firstNonBlank(existing?.canonicalName, canonicalName),
    aliases: mergeAliases(existing?.aliases ?? [], aliases, canonicalName)
  };
}

export function getConceptKnowledgeFromProfile(
  concept: Concept | ConceptSegment | string,
  profile: LocalContextProfile | null
): ConceptKnowledge | null {
  if (!profile) {
    return null;
  }
  const identity = resolveConceptIdentity(concept, profile);
  return identity.key ? profile.concepts[identity.key] ?? null : null;
}

export async function getProfile(storage: StorageArea = chromeStorage()): Promise<LocalContextProfile> {
  try {
    const stored = await storage.get(PROFILE_STORAGE_KEY);
    const profile = validateProfile(stored[PROFILE_STORAGE_KEY]);
    if (profile) {
      return profile;
    }
  } catch {
    // Corrupt or unavailable storage falls back to a safe local default.
  }

  const safeDefault = createDefaultProfile();
  await saveProfile(safeDefault, storage);
  return safeDefault;
}

export async function saveProfile(profile: LocalContextProfile, storage: StorageArea = chromeStorage()): Promise<void> {
  await storage.set({ [PROFILE_STORAGE_KEY]: validateProfile(profile) ?? createDefaultProfile() });
}

export async function getConceptKnowledge(
  concept: Concept | ConceptSegment | string,
  storage: StorageArea = chromeStorage()
): Promise<ConceptKnowledge | null> {
  const profile = await getProfile(storage);
  return getConceptKnowledgeFromProfile(concept, profile);
}

export async function markConceptKnown(
  concept: Concept | ConceptSegment | string,
  storage: StorageArea = chromeStorage(),
  now = Date.now()
): Promise<LocalContextProfile> {
  const profile = await getProfile(storage);
  const identity = resolveConceptIdentity(concept, profile);
  const key = identity.key;
  const canonicalName = identity.canonicalName.trim();

  if (!key || !canonicalName) {
    return profile;
  }

  const existing = profile.concepts[key];
  const next: ConceptKnowledge = {
    canonicalName,
    aliases: identity.aliases,
    state: "COMFORTABLE",
    confidence: 0.9,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    evidenceCount: Math.max(0, existing?.evidenceCount ?? 0) + 1,
    source: "USER_EXPLICIT"
  };

  const nextProfile: LocalContextProfile = {
    ...profile,
    concepts: {
      ...profile.concepts,
      [key]: next
    }
  };

  await saveProfile(nextProfile, storage);
  return nextProfile;
}

export async function markConceptNeedsSimpler(
  concept: Concept | ConceptSegment | string,
  storage: StorageArea = chromeStorage(),
  now = Date.now()
): Promise<LocalContextProfile> {
  const profile = await getProfile(storage);
  const identity = resolveConceptIdentity(concept, profile);
  const key = identity.key;
  const canonicalName = identity.canonicalName.trim();

  if (!key || !canonicalName) {
    return profile;
  }

  const existing = profile.concepts[key];
  const next: ConceptKnowledge = {
    canonicalName,
    aliases: identity.aliases,
    state: "LEARNING",
    confidence: 0.3,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    evidenceCount: Math.max(0, existing?.evidenceCount ?? 0) + 1,
    source: "USER_EXPLICIT"
  };

  const nextProfile: LocalContextProfile = {
    ...profile,
    concepts: {
      ...profile.concepts,
      [key]: next
    }
  };

  await saveProfile(nextProfile, storage);
  return nextProfile;
}

export async function upsertConceptKnowledge(
  concept: Concept | ConceptSegment | string,
  update: Partial<ConceptKnowledge>,
  storage: StorageArea = chromeStorage(),
  now = Date.now()
): Promise<LocalContextProfile> {
  const profile = await getProfile(storage);
  const identity = resolveConceptIdentity(concept, profile);
  const key = identity.key;
  const canonicalName = firstNonBlank(update.canonicalName, identity.canonicalName, getCanonicalName(concept));
  if (!key || !canonicalName) {
    return profile;
  }

  const existing = profile.concepts[key];
  const next: ConceptKnowledge = sanitizeConceptKnowledge({
    canonicalName,
    aliases: mergeAliases(identity.aliases, update.aliases ?? [], canonicalName),
    state: existing?.state ?? "UNKNOWN",
    confidence: existing?.confidence ?? 0,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    evidenceCount: existing?.evidenceCount ?? 0,
    source: existing?.source,
    ...update
  }, key) ?? {
    canonicalName,
    state: "UNKNOWN",
    confidence: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    evidenceCount: 0
  };

  const nextProfile: LocalContextProfile = {
    ...profile,
    concepts: {
      ...profile.concepts,
      [key]: next
    }
  };

  await saveProfile(nextProfile, storage);
  return nextProfile;
}

export async function resetProfile(storage: StorageArea = chromeStorage()): Promise<LocalContextProfile> {
  const profile = createDefaultProfile();
  await saveProfile(profile, storage);
  return profile;
}

export function validateProfile(value: unknown): LocalContextProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const goal = isGoal(value.goal) ? value.goal : DEFAULT_PROFILE.goal;
  const concepts: Record<string, ConceptKnowledge> = {};
  const rawConcepts = isRecord(value.concepts) ? value.concepts : {};

  for (const [key, entry] of Object.entries(rawConcepts)) {
    const normalizedKey = normalizeConceptName(key);
    const knowledge = sanitizeConceptKnowledge(entry, normalizedKey);
    if (normalizedKey && knowledge) {
      concepts[normalizedKey] = knowledge;
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    goal,
    concepts
  };
}

export function createMemoryStorage(initialProfile?: unknown): StorageArea {
  const values: Record<string, unknown> = initialProfile === undefined ? {} : { [PROFILE_STORAGE_KEY]: initialProfile };
  return {
    async get(key: string) {
      return { [key]: values[key] };
    },
    async set(nextValues: Record<string, unknown>) {
      Object.assign(values, nextValues);
    },
    async remove(key: string) {
      delete values[key];
    }
  };
}

export function createDefaultProfile(): LocalContextProfile {
  return {
    schemaVersion: SCHEMA_VERSION,
    goal: "UNDERSTAND",
    concepts: {}
  };
}

function findExistingConceptKey(candidateKeys: string[], profile: LocalContextProfile): string {
  for (const key of candidateKeys) {
    if (profile.concepts[key]) {
      return key;
    }
  }

  for (const [storedKey, knowledge] of Object.entries(profile.concepts)) {
    const aliasKeys = normalizeAliasList(knowledge.aliases).map(normalizeConceptName);
    if (candidateKeys.some((key) => aliasKeys.includes(key) || normalizeConceptName(knowledge.canonicalName) === key)) {
      return storedKey;
    }
  }

  return "";
}

function normalizeAliasList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniqueStrings(values)
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 1)
      .slice(0, 8);
}

function mergeAliases(existing: string[], incoming: string[], canonicalName: string): string[] {
  const canonicalKey = normalizeConceptName(canonicalName);
  return uniqueStrings([...existing, ...incoming])
      .filter((alias) => normalizeConceptName(alias) && normalizeConceptName(alias) !== canonicalKey)
      .slice(0, 8);
}

function chromeStorage(): StorageArea {
  return chrome.storage.local;
}

function sanitizeConceptKnowledge(value: unknown, key: string): ConceptKnowledge | null {
  if (!isRecord(value)) {
    return null;
  }

  const canonicalName = firstNonBlank(
      typeof value.canonicalName === "string" ? value.canonicalName : "",
      key
  );
  if (!canonicalName) {
    return null;
  }

  return {
    canonicalName,
    aliases: mergeAliases(normalizeAliasList(value.aliases), [key], canonicalName),
    state: isKnowledgeState(value.state) ? value.state : "UNKNOWN",
    confidence: clampNumber(value.confidence, 0, 1),
    firstSeenAt: typeof value.firstSeenAt === "number" && Number.isFinite(value.firstSeenAt) ? value.firstSeenAt : undefined,
    lastSeenAt: typeof value.lastSeenAt === "number" && Number.isFinite(value.lastSeenAt) ? value.lastSeenAt : Date.now(),
    evidenceCount: typeof value.evidenceCount === "number" && Number.isInteger(value.evidenceCount) && value.evidenceCount >= 0 ? value.evidenceCount : 0,
    source: isKnowledgeSource(value.source) ? value.source : undefined
  };
}

function clampNumber(value: unknown, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoal(value: unknown): value is LocalGoal {
  return value === "UNDERSTAND" || value === "INTERVIEW" || value === "BUILD";
}

function isKnowledgeState(value: unknown): value is KnowledgeState {
  return value === "UNKNOWN" || value === "LEARNING" || value === "FAMILIAR" || value === "COMFORTABLE";
}

function isKnowledgeSource(value: unknown): value is KnowledgeSource {
  return value === "USER_EXPLICIT" || value === "SYSTEM_INFERRED";
}

function firstNonBlank(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    const key = normalizeConceptName(trimmed);
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
