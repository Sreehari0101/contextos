# Hackathon Submission Notes

## One-Liner

ContextOS is a quiet personal context layer for YouTube that explains only the missing prerequisite a viewer needs at the current moment.

## Problem

Long videos often assume background knowledge. Viewers either pause to search, miss the point, or get overwhelmed by generic summaries that explain too much.

## Solution

ContextOS creates a reusable Context Manifest for a video, keeps the viewer’s knowledge profile locally in the browser, and uses a deterministic policy to decide whether to stay silent or show minimum sufficient context.

## What Makes It Different

- It is not chat with a video.
- It does not summarize everything.
- It prioritizes silence over noisy assistance.
- Personal learning state stays local.
- Expensive semantic work is cached.

## Demo Flow

1. Open an educational YouTube video.
2. Show ContextOS detecting the current segment.
3. Show a short explanation for an unknown concept.
4. Click `I know this`; show that the same concept becomes silent.
5. Switch Goal Lens to `INTERVIEW` or `BUILD`; show focused framing.
6. Open Why Now; show deterministic policy explanation.
7. Click `I'm lost`; show local prerequisite diagnosis.
8. Use Jump to earlier timestamp when available.
9. Open passive/entertainment content; show no intervention.

## Architecture

```text
YouTube -> Chrome Extension -> local policy/profile
                         \-> Spring Boot backend -> Gemini + shared manifest cache
```

Local:

- timestamp matching
- profile
- Knowledge Delta
- policy
- Why Now
- I know this
- repair diagnosis

Cloud/backend:

- video analysis
- shared Context Manifest
- optional personalized Bridge text
- Firestore manifest persistence in GCP mode

## Privacy

Personal concepts, goal, and knowledge state remain in `chrome.storage.local`. The backend stores shared manifests by public video ID. There is no Firebase Auth and no cloud personal profile in V1.

## Current Validation

Automated local validation passes:

- extension tests
- backend tests

The final live Cloud Run/Gemini video matrix still needs to be run with the final Google project credentials.
