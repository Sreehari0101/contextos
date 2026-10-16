# Known Limitations

## Live Evaluation

- The full 15-video live Gemini evaluation has not been run in this repository session.
- Manual Chrome DevTools network-call audit has not been run in this session.
- Live YouTube rapid navigation and rapid seeking were not browser-tested in this session.

## Deployment

- Cloud Run deployment is prepared but not executed.
- Firestore mode is implemented but not live-verified after Cloud Run restart in this session.
- Dockerfile is present, but Docker build could not be completed because Docker daemon was unavailable locally during the Day 13 run.

## Product Scope

- No user accounts.
- No Firebase Auth.
- No cloud personal profile.
- No cross-device personal sync.
- No transcript, notes, quiz, dashboard, or recommendation engine.
- No Chrome Web Store release packaging yet.

## Gemini

- Gemini availability depends on the self-hosting user’s Google project/API access.
- If Gemini returns project-level `403 PERMISSION_DENIED`, the correct fix is Google project/API access, not changing core ContextOS logic.

## Data Model

- Concept identity is intentionally conservative. Some valid synonyms may not merge until the manifest provides an alias.
- False merges are treated as worse than missed merges.
