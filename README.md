# ContextOS

ContextOS is a small personal context layer beside YouTube. It watches the current video timestamp, maps it to a cached Context Manifest, compares the current concept with a local learner profile, and stays quiet unless a short explanation is likely useful.

It is not a chatbot, notes app, transcript viewer, quiz tool, or course platform. The V1 principle is: minimum missing context, at the moment it is needed.

## What It Solves

Long educational or contextual videos often assume background knowledge. ContextOS helps a viewer recover just enough prerequisite context without leaving the video or sending their personal learning profile to the cloud.

## Project Status

This is an open-source prototype. Automated tests and local builds have passed; a full live-video evaluation, Docker runtime validation, and Cloud Run/Firestore deployment validation remain incomplete. See [evaluation results](docs/evaluation/evaluation-results.md) and [known limitations](docs/evaluation/known-limitations.md). Mock mode returns a fixed Kubernetes fixture for every video; it is for development, not evidence of video understanding.

## V1 Features

- Chrome Manifest V3 extension with native side panel
- YouTube watch-page detection, SPA navigation handling, and timestamp tracking
- Spring Boot backend
- Gemini video analysis for sparse Context Manifests
- Relevance modes: `LEARNING`, `CONTEXTUAL`, `PASSIVE`
- Analyze-once manifest caching with memory or Firestore persistence
- Local Knowledge Profile in `chrome.storage.local`
- Knowledge states: `UNKNOWN`, `LEARNING`, `FAMILIAR`, `COMFORTABLE`
- Deterministic local Context Policy: `SHOW` or `SILENT`
- Personalized bridge explanations, Simpler, Goal Lens, Why Now
- Context Repair: “I’m lost”, local prerequisite diagnosis, repair explanation, and jump to earlier timestamp
- Conservative cross-video concept identity through canonical names and aliases
- Mock mode for contributors without Gemini access

## Architecture

```text
Chrome Extension
  content script: YouTube URL/video/timestamp signal
  side panel: local policy, profile, repair diagnosis
  chrome.storage.local: personal knowledge profile and goal

Spring Boot Backend
  /api/v1/videos/analyze: create or load shared Context Manifest
  /api/v1/videos/{videoId}: read cached manifest
  /api/v1/context/bridge: small personalized explanation calls
  /api/v1/health: container health

Gemini
  video analysis for new videos
  small bridge/simpler/repair text calls

Persistence
  local mode: memory
  GCP mode: Firestore collection context_manifests/{videoId}
```

Personal knowledge remains local in the browser. Cloud persistence stores shared video manifests keyed by public YouTube video ID, not user profiles.

## Requirements

- Node.js 22.12+ (or a compatible newer LTS)
- npm
- Java 21+
- Maven
- Chrome
- Optional: Docker
- Optional for AI mode: Gemini Developer API key
- Optional for GCP mode: Google Cloud project with Firestore

## Repository Structure

```text
contextos/
  backend/      Spring Boot API, Gemini analyzer, Firestore repository, Dockerfile
  extension/    Chrome MV3 extension, React side panel, local policy/runtime
  deploy/       Cloud Run helper script
  docs/         Architecture/evaluation notes and screenshots
```

## Local Setup

```bash
git clone https://github.com/Sreehari0101/contextos.git
cd contextos
npm ci
cp backend/.env.example backend/.env
cp extension/.env.example extension/.env
```

Mock mode works without Gemini or Firestore:

```bash
cd backend
SPRING_PROFILES_ACTIVE=local CONTEXTOS_GEMINI_ENABLED=false mvn spring-boot:run
```

In another terminal:

```bash
cd contextos
npm run build
```

Load the extension:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `contextos/extension/dist`
5. Open a YouTube watch page
6. Open the ContextOS side panel from the extension icon

## Gemini API Setup

Create a Gemini API key in Google AI Studio and provide it only to the backend. Run the following from `backend/`. Maven does not automatically load `.env`: either export variables as below, or edit your trusted local `.env` and run `set -a; source .env; set +a` first. Never source a file from an untrusted contributor.

```bash
export GOOGLE_API_KEY="your_key_here"
export CONTEXTOS_GEMINI_ENABLED=true
export CONTEXTOS_GEMINI_MODEL=gemini-3.5-flash-lite
mvn spring-boot:run
```

Never put a Gemini key in `extension/.env`; Vite environment values are bundled into extension output.

## Environment Variables

Backend:

```text
SPRING_PROFILES_ACTIVE
PORT
GOOGLE_API_KEY
CONTEXTOS_GEMINI_ENABLED
CONTEXTOS_GEMINI_MODEL
CONTEXTOS_PERSISTENCE
CONTEXTOS_ALLOWED_ORIGINS
GOOGLE_CLOUD_PROJECT
GOOGLE_APPLICATION_CREDENTIALS
```

Extension:

```text
VITE_CONTEXTOS_API_BASE_URL
```

## Local Mode

Local mode is for contributors and self-hosting on a laptop:

```bash
SPRING_PROFILES_ACTIVE=local
CONTEXTOS_PERSISTENCE=memory
CONTEXTOS_GEMINI_ENABLED=false
```

Enable Gemini locally by setting `GOOGLE_API_KEY` and `CONTEXTOS_GEMINI_ENABLED=true`.

## GCP Mode

GCP mode is intended for a small Cloud Run hackathon demo:

```bash
SPRING_PROFILES_ACTIVE=gcp
CONTEXTOS_PERSISTENCE=firestore
CONTEXTOS_GEMINI_ENABLED=true
GOOGLE_CLOUD_PROJECT=your_project_id
```

Use Cloud Run’s service account for Firestore via Application Default Credentials. Do not package or commit a service-account JSON file.

## Firestore Setup

Create or select a Google Cloud/Firebase project, enable Firestore, and let the Cloud Run service account read/write Firestore. The backend uses:

```text
context_manifests/{videoId}
```

For local Firestore testing only, set:

```bash
export CONTEXTOS_PERSISTENCE=firestore
export GOOGLE_CLOUD_PROJECT=your_project_id
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

Keep service-account files outside the repo, for example `~/.config/contextos/firebase-service-account.json`.

## Cloud Run Deployment

Prepare a Secret Manager secret containing the Gemini API key, then review and run:

```bash
PROJECT_ID=your_project_id \
REGION=us-central1 \
SERVICE_NAME=contextos-backend \
GEMINI_SECRET_NAME=contextos-gemini-api-key \
CONTEXTOS_ALLOWED_ORIGINS=chrome-extension://your_extension_id \
bash deploy/cloud-run.sh
```

The script uses min instances `0` and max instances `2`. This does not cap spending. It deploys an unauthenticated API; CORS is not authentication and does not prevent direct API calls. Keep deployments controlled, monitor quota/billing, and do not advertise a shared public Gemini-backed endpoint as abuse-protected.

Set the Cloud Run runtime service account's Firestore access and Secret Manager secret access before deploying. The script assumes these permissions and the secret already exist. For a deployed extension, also add the exact backend origin followed by `/*` to `extension/public/manifest.json` under `host_permissions`, then rebuild; currently only local backend origins are included.

After deployment, build the extension with:

```bash
VITE_CONTEXTOS_API_BASE_URL=https://your-cloud-run-url npm run build
```

## Docker

Build the backend image:

```bash
docker build -t contextos-backend ./backend
```

Run locally:

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  -e CONTEXTOS_GEMINI_ENABLED=false \
  contextos-backend
```

Health check:

```bash
curl http://127.0.0.1:8080/api/v1/health
```

The health endpoint confirms the backend is alive. It does not call Gemini.

## Privacy Model

- Personal profile stays in `chrome.storage.local`.
- Stored personal data includes known concepts, aliases, confidence/state, goal, and local interaction state.
- Shared backend storage contains public video manifests keyed by YouTube video ID.
- Bridge requests send only the current concept, prerequisites, goal, and a small list of known anchors needed for the explanation.
- No Firebase Auth or cloud user profile exists in V1.

## Cost-Conscious Design

- New video analysis can call Gemini once, then reuses the cached manifest.
- Timestamp matching, Knowledge Delta, Context Policy, Why Now, I know this, and repair diagnosis run locally.
- Bridge/Simpler/Repair use smaller text payloads and are cached in the extension session.
- PASSIVE content stays silent and does not request bridge explanations.

## Tests

From the repo root:

```bash
npm --workspace extension run test
npm run typecheck
npm --workspace extension run build
mvn -f backend/pom.xml test
mvn -f backend/pom.xml package
```

Root helpers:

```bash
npm run build
npm run typecheck
npm test
```

## Current Limitations

- Prototype quality deployment, not production hardening.
- No Chrome Web Store packaging yet.
- No user accounts or cross-device personal sync.
- Firestore stores shared manifests only.
- Gemini availability depends on the user’s Google project/API access.
- Docker and Cloud Run require the user’s own local/GCP credentials.

## Secret Safety

Committed:

- source code
- docs
- `.env.example`
- tests

Never commit:

- `.env`
- Gemini keys
- service-account JSON
- Firebase Admin SDK JSON
- `extension/dist`
- `backend/target`
- `node_modules`

## License

Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md). Security and credential handling: see [SECURITY.md](SECURITY.md).

MIT
