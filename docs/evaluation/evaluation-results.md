# V1 Evaluation Results

Date: 2026-10-02  
Environment: local repository, local backend tests, local extension build/tests  
Gemini live access: not exercised in this run  
Cloud Run / Firestore live deployment: not exercised in this run

## Summary

The automated V1 reliability suite passes locally. Live 15-video Gemini evaluation remains a release task because no live Gemini/YouTube browser matrix was run in this session.

## Tests Run

| Area | Command | Result |
|---|---|---|
| Extension tests | `npm --workspace extension run test` | PASS |
| Backend tests | `mvn test` | PASS, 26/26 |

Additional release commands are recorded in `release-checklist.md`.

## Videos Tested

Live 15-video set: not run in this session.

Prepared test set: see `videos.md`.

## Relevance Results

Automated fixture coverage:

- PASSIVE videos are converted to `NO_CONTEXT_REQUIRED`.
- PASSIVE manifests drop segments.
- PASSIVE policy stays `SILENT`.
- CONTEXTUAL threshold is stricter than LEARNING.
- FAILED analysis remains distinct from `NO_CONTEXT_REQUIRED`.

Live classification count:

```text
classification count: 0 live videos
correct classifications: not measured
incorrect classifications: not measured
```

## Passive False-Intervention Result

Fixture result:

```text
passive fixture paths tested: backend validator + policy coverage
passive paths that produced unwanted context: 0 in automated policy path
```

Live result:

```text
not measured
```

## Persona Tests

Automated coverage verifies profile behavior, known concept suppression, simpler feedback, anchors, and goal cache keys.

Manual/live persona bridge outputs were not collected because Gemini live mode was not exercised.

## Policy Evaluation Results

Automated policy tests passed:

- PASSIVE always silent.
- `NO_CONTEXT_REQUIRED` silent.
- unknown core learning concept shows.
- comfortable high concept silent.
- unknown prerequisite raises gap score.
- CONTEXTUAL is stricter than LEARNING.
- failed analysis returns error reason, not knowledge certainty.

## Personalization Results

Automated bridge tests passed:

- known anchors selected from relevant profile concepts.
- cache key includes goal.
- bridge failure keeps generic explanation.
- stale response detection works.

Manual output quality evaluation was not run.

## Goal Lens Results

Automated/backend tests passed:

- `UNDERSTAND`, `INTERVIEW`, and `BUILD` are preserved in bridge requests.
- mock generator frames interview/build differently.
- cache key includes goal.

Manual output quality evaluation was not run.

## Minimum Context Metric

Live bridge word counts were not collected.

Backend validator bounds explanation length and falls back on invalid/oversized bridge output.

## Cross-Video Results

Automated tests passed:

| Case | Result |
|---|---|
| Kubernetes Pod ↔ K8s Pod | resolved |
| Java Virtual Machine ↔ JVM | resolved |
| REST API ↔ RESTful API | resolved |
| Kafka ≠ Kafka Consumer Group | no false merge |

Additional false merge cases to run manually:

- Kubernetes ≠ Kubernetes Pod
- Docker ≠ Container
- HTTP ≠ REST API
- Spring ≠ Spring Boot

## I Know This Test

Automated coverage:

- `UNKNOWN` core concept initially shows.
- `markConceptKnown` changes state to `COMFORTABLE`.
- policy becomes `SILENT`.
- no backend/Gemini path is used by profile storage tests.

Manual click/network DevTools audit was not run.

## Simpler Test

Automated coverage:

- Simpler changes concept state to `LEARNING`.
- request variant is `SIMPLER`.
- goal is preserved.
- failure keeps previous/generic explanation.

Manual output quality evaluation was not run.

## Why Now Test

Automated coverage:

- deterministic reason mapping.
- missing prerequisite reason uses policy delta.
- no anchor claim unless bridge response is personalized and anchor is known.
- silent states do not invent explanations.

No Gemini call is present in the Why Now code path.

## Context Repair Test

Automated coverage:

- direct unknown prerequisite selected.
- direct learning prerequisite selected.
- comfortable direct prerequisites ignored.
- one-hop indirect prerequisite selected.
- current concept fallback when no prerequisite is missing.
- no-clear-prerequisite fallback when current concept is comfortable.
- earlier timestamp uses alias match.
- repair bridge uses `REPAIR` variant.
- cycles do not recurse forever.

Manual Jump and Explain buttons were not browser-tested in this session.

## Network Call Audit

Code-path result:

| Action | Backend Call | Gemini Call |
|---|---:|---:|
| Playback timestamp change | No | No |
| Policy evaluation | No | No |
| I know this | No | No |
| Why Now | No | No |
| I'm lost diagnosis | No | No |
| Jump to timestamp | No | No |
| Goal selection | No | No |
| New video analysis | Yes | Gemini if enabled |
| Personalized Bridge | Yes | Gemini if enabled |
| Simpler | Yes | Gemini if enabled |
| Repair explanation | Yes | Gemini if enabled |
| Cached Bridge revisit | No | No |

## Gemini Call Count Test

Not live-run. Development counters exist in dev builds as `contextosApiCounters`:

- `manifestReads`
- `videoAnalysisCalls`
- `bridgeCalls`

## Cache Test

Automated/backend result:

- READY manifest cache hit avoids analyzer call.
- `NO_CONTEXT_REQUIRED` manifests are reusable.
- FAILED manifests are retryable and do not permanently block analysis.

Firestore restart persistence was not live-tested.

## Performance Measurements

Observed local commands from recent runs:

- Extension production build: about 1.1s.
- Backend test suite: about 3-6s.
- Packaged backend started in about 1.5s before health endpoint was reachable.

Not measured:

- live manifest retrieval latency
- live Gemini bridge latency
- live repair response latency
- live side-panel load-to-useful-state

## Failure Tests

Automated coverage:

- malformed bridge response retries/falls back.
- bridge generation exception returns controlled API error.
- oversized bridge response falls back.
- malformed profile recovers safely.
- failed video analysis remains `FAILED`.
- invalid/malformed manifests become `FAILED`.

Not live-tested:

- Gemini 403
- Gemini timeout
- Firestore unavailable
- private/deleted YouTube video
- rapid navigation in Chrome
- rapid seeking in Chrome

## Defects Found / Fixed During Final Stretch

- Evaluation docs were Phase 1 placeholders and did not reflect V1.
- Release evidence was scattered across command output instead of documented.

Fix:

- Added final V1 evaluation docs and release checklist.
