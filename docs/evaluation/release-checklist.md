# V1 Release Checklist

## Required Before Public Demo

- [x] Extension tests pass.
- [x] Backend tests pass.
- [x] README documents local and GCP modes.
- [x] `.env.example` files contain placeholders only.
- [x] Secret scan found no tracked secrets beyond placeholder docs/examples.
- [x] Extension typecheck pass recorded after final docs pass.
- [x] Extension production build pass recorded after final docs pass.
- [x] Backend package pass recorded after final docs pass.
- [ ] Docker build verified with Docker daemon running.
- [ ] Cloud Run deployed and health checked.
- [ ] Firestore mode verified in target GCP project.
- [ ] Production extension built with deployed Cloud Run URL.
- [ ] Live Gemini call verified, or Google project access limitation recorded.
- [ ] 15-video evaluation matrix run and appended to `evaluation-results.md`.
- [ ] Manual Chrome side-panel smoke test recorded.

## Local Release Commands

```bash
npm --workspace extension run test
npm run typecheck
npm --workspace extension run build
cd backend && mvn test
cd backend && mvn package
```

## Docker Verification

```bash
docker build -t contextos-backend ./backend
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  -e CONTEXTOS_GEMINI_ENABLED=false \
  contextos-backend
curl http://127.0.0.1:8080/api/v1/health
```

## Cloud Run Verification

```bash
PROJECT_ID=your_project_id \
REGION=us-central1 \
SERVICE_NAME=contextos-backend \
GEMINI_SECRET_NAME=contextos-gemini-api-key \
CONTEXTOS_ALLOWED_ORIGINS=chrome-extension://your_extension_id \
bash deploy/cloud-run.sh
```

Then build extension:

```bash
VITE_CONTEXTOS_API_BASE_URL=https://your-cloud-run-url npm run build
```
