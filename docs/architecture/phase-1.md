# Phase 1 Architecture

Phase 1 proves that ContextOS can run beside real YouTube pages without owning video playback.

## Components

- `content.ts`: runs on YouTube pages, reads `window.location`, page title, and the HTML video element.
- `background.ts`: stores the latest watch state per tab and relays it to side panels.
- `sidepanel/App.tsx`: renders the native Chrome side panel UI.

## Message Flow

```text
YouTube page
  -> content script reads video ID, timestamp, title
  -> background service worker stores tab state
  -> side panel receives latest state over a long-lived port
```

## SPA Navigation

YouTube is a single-page application. The content script listens to:

- `yt-navigate-finish`
- `popstate`
- patched `history.pushState`
- patched `history.replaceState`
- DOM mutations for title/video readiness

The content script sends a state update immediately and then once per second when meaningful playback state changes.
