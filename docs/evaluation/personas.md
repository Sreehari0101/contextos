# V1 Evaluation Personas

These personas are deterministic local profile fixtures. They do not contain personal or sensitive data.

## Persona A: New Learner

Goal: `UNDERSTAND`

Knowledge:

```json
{
  "concepts": {}
}
```

Purpose:

- Maximum-context case.
- Unknown core concepts should usually show in `LEARNING` content.
- Repair should find missing direct or one-hop prerequisites when graph data supports it.

## Persona B: Backend Developer

Goal: `BUILD`

Knowledge:

```json
{
  "java": "COMFORTABLE",
  "rest api": "COMFORTABLE",
  "database": "COMFORTABLE",
  "docker": "FAMILIAR",
  "http": "COMFORTABLE"
}
```

Purpose:

- Validate useful known anchors.
- Validate build-oriented bridge framing.
- Ensure the system does not over-explain concepts already marked comfortable.

## Persona C: Interview Prep

Goal: `INTERVIEW`

Knowledge:

```json
{
  "java": "COMFORTABLE",
  "database": "FAMILIAR",
  "docker": "COMFORTABLE",
  "kubernetes pod": "FAMILIAR",
  "kafka": "FAMILIAR"
}
```

Purpose:

- Validate reduced interruptions compared with Persona A.
- Validate interview framing remains short.
- Check that familiar concepts still allow prerequisite repair when needed.
