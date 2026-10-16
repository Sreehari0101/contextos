import { readWatchState } from "../services/youtube";
import type { BackgroundToContentMessage, ContentToBackgroundMessage, YouTubeWatchState } from "../types/messages";

let lastSignature = "";
let intervalId: number | undefined;
let observer: MutationObserver | undefined;

function sendState(force = false): void {
  const state = readWatchState();
  const signature = getStateSignature(state);

  if (!force && signature === lastSignature) {
    return;
  }

  lastSignature = signature;
  const message: ContentToBackgroundMessage = {
    type: "CONTEXTOS_VIDEO_STATE",
    payload: state
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // The extension context can briefly disappear during reloads or updates.
  });
}

function getStateSignature(state: YouTubeWatchState): string {
  const second = state.currentTimeSeconds === null ? "none" : Math.floor(state.currentTimeSeconds);
  const duration = state.durationSeconds === null ? "none" : Math.floor(state.durationSeconds);
  return [
    state.status,
    state.videoId,
    state.title,
    second,
    duration,
    state.isPlaying
  ].join("|");
}

function patchHistoryMethod(methodName: "pushState" | "replaceState"): void {
  const original = window.history[methodName];

  window.history[methodName] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    window.dispatchEvent(new Event("contextos:navigation"));
    return result;
  };
}

function watchForYouTubeNavigation(): void {
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", () => sendState(true));
  window.addEventListener("yt-navigate-finish", () => sendState(true));
  window.addEventListener("contextos:navigation", () => {
    window.setTimeout(() => sendState(true), 250);
    window.setTimeout(() => sendState(true), 1000);
  });
}

function watchDomForTitleAndVideoChanges(): void {
  observer = new MutationObserver(() => sendState(false));
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function start(): void {
  watchForYouTubeNavigation();
  watchDomForTitleAndVideoChanges();
  sendState(true);

  intervalId = window.setInterval(() => sendState(false), 1000);
}

chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
  if (message?.type !== "CONTEXTOS_SEEK" || !Number.isFinite(message.seconds) || message.seconds < 0) {
    return;
  }

  const video = document.querySelector("video");
  if (!video) {
    return;
  }

  video.currentTime = message.seconds;
  video.play().catch(() => {
    // Autoplay restrictions can prevent play(), but the seek still succeeds.
  });
  window.setTimeout(() => sendState(true), 250);
});

window.addEventListener("beforeunload", () => {
  if (intervalId !== undefined) {
    window.clearInterval(intervalId);
  }

  observer?.disconnect();
});

start();
