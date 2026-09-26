# ContextOS Backend

Java 21 Spring Boot backend for ContextOS.

## Local Mock Mode

```bash
mvn spring-boot:run
```

If `8080` is busy:

```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8090
```

## APIs

- `GET /api/v1/health`
- `POST /api/v1/videos/analyze`
- `GET /api/v1/videos/{videoId}`
- `GET /api/v1/context/current?videoId={videoId}&timestamp={seconds}`

## Secrets You Provide

Copy `.env.example` values into your terminal or deployment environment. Do not commit real keys.
