import type {
  BackgroundToSidePanelMessage,
  ContentToBackgroundMessage,
  SidePanelToBackgroundMessage,
  TabWatchState
} from "../types/messages";

const statesByTab = new Map<number, TabWatchState>();
const sidePanelPorts = new Set<chrome.runtime.Port>();
let mostRecentWatchTabId: number | null = null;

chrome.runtime.onInstalled.addListener(() => {
  enableActionSidePanelOpening();
});

chrome.runtime.onStartup.addListener(() => {
  enableActionSidePanelOpening();
});

function enableActionSidePanelOpening(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chromium builds may not support this behavior flag.
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  if (!url) {
    return;
  }

  const enabled = isYouTubeWatchUrl(url);
  chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled
  }).catch(() => {
    // Tabs such as chrome:// pages do not allow side panel option changes.
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  statesByTab.delete(tabId);
  if (mostRecentWatchTabId === tabId) {
    mostRecentWatchTabId = null;
  }
  broadcastLatestState();
});

chrome.runtime.onMessage.addListener((message: ContentToBackgroundMessage, sender) => {
  if (message?.type !== "CONTEXTOS_VIDEO_STATE" || sender.tab?.id === undefined) {
    return;
  }

  const tabState: TabWatchState = {
    ...message.payload,
    tabId: sender.tab.id
  };

  statesByTab.set(sender.tab.id, tabState);
  chrome.sidePanel.setOptions({
    tabId: sender.tab.id,
    path: "sidepanel.html",
    enabled: tabState.status === "WATCHING" && Boolean(tabState.videoId)
  }).catch(() => {
    // Some tabs do not allow side panel option changes.
  });

  if (tabState.status === "WATCHING" && tabState.videoId) {
    mostRecentWatchTabId = sender.tab.id;
  }

  broadcastLatestState();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "contextos-sidepanel") {
    return;
  }

  sidePanelPorts.add(port);
  sendToPort(port, { type: "CONTEXTOS_STATE_UPDATE", payload: getLatestState() });

  port.onMessage.addListener((message: SidePanelToBackgroundMessage) => {
    if (message.type === "CONTEXTOS_SIDE_PANEL_READY" || message.type === "CONTEXTOS_REQUEST_STATE") {
      sendToPort(port, { type: "CONTEXTOS_STATE_UPDATE", payload: getLatestState() });
      return;
    }

    if (message.type === "CONTEXTOS_SEEK" && Number.isFinite(message.seconds) && message.seconds >= 0) {
      seekMostRecentWatchTab(message.seconds);
    }
  });

  port.onDisconnect.addListener(() => {
    sidePanelPorts.delete(port);
  });
});

function broadcastLatestState(): void {
  const message: BackgroundToSidePanelMessage = {
    type: "CONTEXTOS_STATE_UPDATE",
    payload: getLatestState()
  };

  for (const port of sidePanelPorts) {
    sendToPort(port, message);
  }
}

function seekMostRecentWatchTab(seconds: number): void {
  if (mostRecentWatchTabId === null) {
    return;
  }

  chrome.tabs.sendMessage(mostRecentWatchTabId, {
    type: "CONTEXTOS_SEEK",
    seconds
  }).catch(() => {
    // The content script can be unavailable during navigation or extension reload.
  });
}

function getLatestState(): TabWatchState | null {
  if (mostRecentWatchTabId !== null) {
    const state = statesByTab.get(mostRecentWatchTabId);
    if (state) {
      return state;
    }
  }

  const states = [...statesByTab.values()].sort((a, b) => b.capturedAt - a.capturedAt);
  return states[0] ?? null;
}

function sendToPort(port: chrome.runtime.Port, message: BackgroundToSidePanelMessage): void {
  try {
    port.postMessage(message);
  } catch {
    sidePanelPorts.delete(port);
  }
}

function isYouTubeWatchUrl(urlValue: string): boolean {
  try {
    const url = new URL(urlValue);
    return url.hostname.endsWith("youtube.com") && url.pathname === "/watch" && url.searchParams.has("v");
  } catch {
    return false;
  }
}
