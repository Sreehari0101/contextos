# V1 Evaluation Plan

## Goals

Validate that ContextOS V1 is:

- quiet when context is not useful
- minimal when context is useful
- safe when Gemini/backend/storage fail
- conservative about concept identity
- cheap in normal playback

## Procedure

1. Select the 15 public videos from `videos.md`.
2. Confirm each expected mode before running ContextOS.
3. Run each video through the extension with the backend in the target mode:
   - local mock mode for smoke tests
   - local Gemini mode for model behavior
   - GCP mode for deployed demo validation
4. Record expected mode, detected mode, passive interventions, segments tested, persona policy decisions, bridge word counts, repair behavior, and network/Gemini call counts.
5. Fix only defects that affect V1 correctness, reliability, demo quality, cost, or trust.

## Relevance Metrics

For the 15-video set:

- classification count
- correct classifications
- incorrect classifications
- PASSIVE false intervention rate

PASSIVE false intervention rate:

```text
passive videos with unwanted context / passive videos tested
```

## Policy Tests

Run each selected learning segment against Persona A, Persona B, and Persona C.

Record concept, importance, knowledge state, gap score, policy decision, and expected decision.

## Network Call Audit

| Action | Backend Call Expected | Gemini Call Expected |
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
