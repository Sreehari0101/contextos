import {
  createMemoryStorage,
  getConceptKey,
  getConceptKnowledge,
  getProfile,
  markConceptKnown,
  normalizeConceptName,
  resolveConceptIdentity
} from "./profileStorage";
import type { ConceptSegment } from "../types/api";

async function run() {
  await testDefaultProfileCreation();
  testConceptKeyNormalization();
  await testMarkConceptKnown();
  await testRepeatedMarkConceptKnown();
  await testCrossVideoSameConcept();
  await testAliasConnectsKubernetesPodAcrossVideos();
  await testAliasConnectsJvmAcrossVideos();
  await testAliasConnectsRestApiAcrossVideos();
  await testFalseMergeDoesNotConnectKafkaConsumerGroup();
  await testLegacyProfileMigratesToSchemaV2();
  await testCorruptedProfileFallback();
  await testMalformedConceptEntryFallback();
  console.log("profileStorage tests passed");
}

async function testDefaultProfileCreation() {
  const storage = createMemoryStorage();
  const profile = await getProfile(storage);

  equal(profile.schemaVersion, 2);
  equal(profile.goal, "UNDERSTAND");
  deepEqual(profile.concepts, {});
}

function testConceptKeyNormalization() {
  equal(getConceptKey("Kubernetes Pod"), "kubernetes pod");
  equal(getConceptKey("  kubernetes   pod  "), "kubernetes pod");
  equal(getConceptKey("Kubernetes Pods"), "kubernetes pod");
  equal(normalizeConceptName("RESTful---APIs!!!"), "restful api");
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

async function testAliasConnectsKubernetesPodAcrossVideos() {
  const storage = createMemoryStorage();
  await markConceptKnown(concept("Kubernetes Pod", "Pod lifecycle", ["K8s Pod", "Pod"]), storage, 1000);

  const profile = await getProfile(storage);
  const identity = resolveConceptIdentity(concept("K8s Pod", "K8s pod crash loop", ["Kubernetes Pod"]), profile);
  const knowledge = await getConceptKnowledge(concept("K8s Pod", "K8s pod crash loop", ["Kubernetes Pod"]), storage);

  equal(identity.key, "kubernetes pod");
  equal(knowledge?.state, "COMFORTABLE");
}

async function testAliasConnectsJvmAcrossVideos() {
  const storage = createMemoryStorage();
  await markConceptKnown(concept("Java Virtual Machine", "JVM internals", ["JVM"]), storage, 1000);

  const knowledge = await getConceptKnowledge("JVM", storage);

  equal(knowledge?.canonicalName, "Java Virtual Machine");
}

async function testAliasConnectsRestApiAcrossVideos() {
  const storage = createMemoryStorage();
  await markConceptKnown(concept("REST API", "REST endpoints", ["RESTful API"]), storage, 1000);

  const knowledge = await getConceptKnowledge("RESTful API", storage);

  equal(knowledge?.state, "COMFORTABLE");
}

async function testFalseMergeDoesNotConnectKafkaConsumerGroup() {
  const storage = createMemoryStorage();
  await markConceptKnown(concept("Kafka", "Kafka broker"), storage, 1000);

  const knowledge = await getConceptKnowledge("Kafka Consumer Group", storage);

  equal(knowledge, null);
}

async function testLegacyProfileMigratesToSchemaV2() {
  const storage = createMemoryStorage({
    schemaVersion: 1,
    goal: "BUILD",
    concepts: {
      JVM: {
        canonicalName: "Java Virtual Machine",
        aliases: ["JVM"],
        state: "COMFORTABLE",
        confidence: 0.8,
        lastSeenAt: 100,
        evidenceCount: 2,
        source: "USER_EXPLICIT"
      }
    }
  });
  const profile = await getProfile(storage);

  equal(profile.schemaVersion, 2);
  equal(profile.goal, "BUILD");
  equal(profile.concepts.jvm.canonicalName, "Java Virtual Machine");
  equal(profile.concepts.jvm.aliases?.[0], "JVM");
}

async function testCorruptedProfileFallback() {
  const storage = createMemoryStorage("not a profile");
  const profile = await getProfile(storage);

  equal(profile.schemaVersion, 2);
  equal(profile.goal, "UNDERSTAND");
  deepEqual(profile.concepts, {});
}

async function testMalformedConceptEntryFallback() {
  const malformedProfile = {
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

function concept(canonicalName: string, title = canonicalName, aliases: string[] = []): ConceptSegment {
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
        description: "Canonical concept.",
        aliases
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
