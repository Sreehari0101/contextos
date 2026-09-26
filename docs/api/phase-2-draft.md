# Phase 2 API Draft

These endpoints are intentionally not implemented in Phase 1.

```http
POST /api/v1/videos/analyze
GET /api/v1/videos/{videoId}
GET /api/v1/context/current?videoId={videoId}&timestamp={seconds}
```

Phase 2 should keep Gemini video analysis and deterministic context policy decisions separated.
