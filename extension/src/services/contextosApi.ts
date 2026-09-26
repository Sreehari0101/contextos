import type { ContextManifest } from "../types/api";

const API_BASE_URL = (import.meta.env.VITE_CONTEXTOS_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

export async function getContextManifest(videoId: string): Promise<ContextManifest | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/videos/${encodeURIComponent(videoId)}`);
  if (response.status === 404) {
    return null;
  }

  return readJson<ContextManifest>(response);
}

export async function analyzeVideo(youtubeUrl: string, title: string | null): Promise<ContextManifest> {
  const response = await fetch(`${API_BASE_URL}/api/v1/videos/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ youtubeUrl, title })
  });

  return readJson<ContextManifest>(response);
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
