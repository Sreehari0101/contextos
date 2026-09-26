import type { WatchPageStatus, YouTubeWatchState } from "../types/messages";

const WATCH_PATH = "/watch";

export function getYouTubeVideoId(urlValue = window.location.href): string | null {
  try {
    const url = new URL(urlValue);
    if (!url.hostname.endsWith("youtube.com") || url.pathname !== WATCH_PATH) {
      return null;
    }

    const videoId = url.searchParams.get("v");
    return videoId && videoId.trim().length > 0 ? videoId : null;
  } catch {
    return null;
  }
}

export function isYouTubeWatchPage(urlValue = window.location.href): boolean {
  return getYouTubeVideoId(urlValue) !== null;
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector("video.html5-main-video") ?? document.querySelector("video");
}

export function getReadableVideoTitle(): string | null {
  const selectors = [
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title yt-formatted-string",
    "h1"
  ];

  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  const title = document.title.replace(/\s+-\s+YouTube$/, "").trim();
  return title || null;
}

export function readWatchState(): YouTubeWatchState {
  const videoId = getYouTubeVideoId();
  const video = getVideoElement();
  let status: WatchPageStatus = "WATCHING";

  if (!videoId) {
    status = "NOT_YOUTUBE_WATCH";
  } else if (!video) {
    status = "NO_VIDEO_ELEMENT";
  }

  return {
    status,
    videoId,
    url: window.location.href,
    title: videoId ? getReadableVideoTitle() : null,
    pageTitle: document.title || null,
    currentTimeSeconds: video ? safeNumber(video.currentTime) : null,
    durationSeconds: video ? safeNumber(video.duration) : null,
    isPlaying: Boolean(video && !video.paused && !video.ended),
    capturedAt: Date.now()
  };
}

function safeNumber(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}
