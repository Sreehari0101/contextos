import type { BridgeRequest, BridgeResponse, ContextManifest } from "../types/api";

const API_BASE_URL = (import.meta.env.VITE_CONTEXTOS_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const counters = {
  manifestReads: 0,
  videoAnalysisCalls: 0,
  bridgeCalls: 0
};

if (import.meta.env.DEV) {
  Object.assign(globalThis, { contextosApiCounters: counters });
}

export async function getContextManifest(videoId: string): Promise<ContextManifest | null> {
  recordCall("manifestReads");
  const response = await fetch(`${API_BASE_URL}/api/v1/videos/${encodeURIComponent(videoId)}`);
  if (response.status === 404) {
    return null;
  }

  return readJson<ContextManifest>(response);
}

export async function analyzeVideo(youtubeUrl: string, title: string | null): Promise<ContextManifest> {
  recordCall("videoAnalysisCalls");
  const response = await fetch(`${API_BASE_URL}/api/v1/videos/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ youtubeUrl, title })
  });

  return readJson<ContextManifest>(response);
}

export async function generateBridge(request: BridgeRequest, signal?: AbortSignal): Promise<BridgeResponse> {
  recordCall("bridgeCalls");
  const response = await fetch(`${API_BASE_URL}/api/v1/context/bridge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    signal
  });

  return readJson<BridgeResponse>(response);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `ContextOS API returned ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function recordCall(name: keyof typeof counters): void {
  counters[name] += 1;
  if (import.meta.env.DEV) {
    console.debug(`[ContextOS API] ${name}`, counters[name]);
  }
}
