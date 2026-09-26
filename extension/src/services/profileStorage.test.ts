import {
  createMemoryStorage,
  getConceptKey,
  getConceptKnowledge,
  getProfile,
  markConceptKnown,
  type LocalContextProfile
} from "./profileStorage";
import type { ConceptSegment } from "../types/api";

async function run() {
  await testDefaultProfileCreation();
  testConceptKeyNormalization();
  await testMarkConceptKnown();
  await testRepeatedMarkConceptKnown();
  await testCrossVideoSameConcept();
  await testCorruptedProfileFallback();
  await testMalformedConceptEntryFallback();
  console.log("profileStorage tests passed");
}

async function testDefaultProfileCreation() {
  const storage = createMemoryStorage();
  const profile = await getProfile(storage);

  equal(profile.schemaVersion, 1);
  equal(profile.goal, "UNDERSTAND");
  deepEqual(profile.concepts, {});
}

function testConceptKeyNormalization() {
  equal(getConceptKey("Kubernetes Pod"), "kubernetes pod");
  equal(getConceptKey("  kubernetes   pod  "), "kubernetes pod");
  equal(getConceptKey("Kubernetes Pods"), "kubernetes pod");
}

async function testMarkConceptKnown() {
  const storage = createMemoryStorage();
  const profile = await markConceptKnown(concept("Kubernetes Pod"), storage, 1000);
  const knowledge = profile.concepts["kubernetes pod"];

  equal(knowledge.state, "COMFORTABLE");
  equal(knowledge.confidence, 0.9);
  equal(knowledge.source, "USER_EXPLICIT");
  equal(knowledge.firstSeenAt, 1000);
  equal(knowledge.lastSeenAt, 1000);
  equal(knowledge.evidenceCount, 1);
}

async function testRepeatedMarkConceptKnown() {
  const storage = createMemoryStorage();
  await markConceptKnown("Kubernetes Pod", storage, 1000);
  const profile = await markConceptKnown("Kubernetes Pod", storage, 2000);
  const knowledge = profile.concepts["kubernetes pod"];

  equal(knowledge.state, "COMFORTABLE");
  equal(knowledge.firstSeenAt, 1000);
  equal(knowledge.lastSeenAt, 2000);
  equal(knowledge.evidenceCount, 2);
}

async function testCrossVideoSameConcept() {
  const storage = createMemoryStorage();
  await markConceptKnown(concept("Kubernetes Pod"), storage, 1000);

  const otherVideoConcept = concept("kubernetes pod", "Pods in another tutorial");
  const knowledge = await getConceptKnowledge(otherVideoConcept, storage);

  equal(knowledge?.state, "COMFORTABLE");
  equal(knowledge?.evidenceCount, 1);
}

async function testCorruptedProfileFallback() {
  const storage = createMemoryStorage("not a profile");
  const profile = await getProfile(storage);

  equal(profile.schemaVersion, 1);
  equal(profile.goal, "UNDERSTAND");
  deepEqual(profile.concepts, {});
}

async function testMalformedConceptEntryFallback() {
  const malformedProfile: LocalContextProfile = {
    schemaVersion: 1,
    goal: "UNDERSTAND",
    concepts: {
      "Kubernetes Pods": {
        canonicalName: "Kubernetes Pods",
        state: "COMFORTABLE",
        confidence: 2,
        lastSeenAt: Number.NaN,
        evidenceCount: -10,
        source: "USER_EXPLICIT"
      }
    }
  };
  const storage = createMemoryStorage(malformedProfile);
  const profile = await getProfile(storage);
  const knowledge = profile.concepts["kubernetes pod"];

  equal(knowledge.canonicalName, "Kubernetes Pods");
  equal(knowledge.state, "COMFORTABLE");
  equal(knowledge.confidence, 1);
  equal(knowledge.evidenceCount, 0);
}

function concept(canonicalName: string, title = canonicalName): ConceptSegment {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    title,
    concept: title,
    description: "A Kubernetes concept.",
    startSeconds: 0,
    endSeconds: 60,
    difficulty: "BEGINNER",
    importance: "CORE",
    concepts: [
      {
        name: title,
        canonicalName,
        description: "Canonical concept."
      }
    ],
    prerequisites: [],
    relatedConcepts: []
  };
}

run().catch((error) => {
  console.error(error);
  throw error;
});

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function deepEqual(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}
