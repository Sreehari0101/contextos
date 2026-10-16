# ContextOS V1 API

The V1 backend exposes a small REST API for manifest analysis/cache, current-context lookup, bridge generation, and health.

## Health

```http
GET /api/v1/health
```

Returns backend liveness only. It does not call Gemini.

## Video Manifest

```http
POST /api/v1/videos/analyze
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "title": "Optional page title"
}
```

Behavior:

- extracts `videoId`
- returns cached READY/NO_CONTEXT_REQUIRED manifest when available
- retries FAILED manifests instead of treating them as permanent success
- calls analyzer only for cache miss/retry
- validates manifest before saving

```http
GET /api/v1/videos/{videoId}
```

Returns cached manifest or `404` when unavailable.

## Current Context

```http
GET /api/v1/context/current?videoId={videoId}&timestamp={seconds}
```

Returns a backend current-context decision for the stored manifest. The extension primarily performs richer V1 policy locally.

## Bridge Generation

```http
POST /api/v1/context/bridge
Content-Type: application/json

{
  "videoId": "abc123",
  "segmentId": "pods",
  "primaryConcept": "Kubernetes Pod",
  "conceptDescription": "Smallest deployable unit.",
  "segmentTitle": "Pods",
  "segmentDescription": "Pods group containers.",
  "importance": "CORE",
  "prerequisites": ["Containers"],
  "knownAnchors": [{"concept": "Docker", "state": "FAMILIAR"}],
  "variant": "DEFAULT",
  "goal": "UNDERSTAND"
}
```

Variants:

- `DEFAULT`
- `SIMPLER`
- `REPAIR`

Goals:

- `UNDERSTAND`
- `INTERVIEW`
- `BUILD`

Bridge failure is non-fatal to the extension. The extension keeps the generic manifest explanation when bridge generation fails.
