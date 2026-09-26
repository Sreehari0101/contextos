export type WatchPageStatus = "WATCHING" | "NOT_YOUTUBE_WATCH" | "NO_VIDEO_ELEMENT";

export type YouTubeWatchState = {
  status: WatchPageStatus;
  videoId: string | null;
  url: string;
  title: string | null;
  pageTitle: string | null;
  currentTimeSeconds: number | null;
  durationSeconds: number | null;
  isPlaying: boolean;
  capturedAt: number;
};

export type TabWatchState = YouTubeWatchState & {
  tabId: number;
};

export type ContentToBackgroundMessage = {
  type: "CONTEXTOS_VIDEO_STATE";
  payload: YouTubeWatchState;
};

export type SidePanelToBackgroundMessage =
  | { type: "CONTEXTOS_SIDE_PANEL_READY" }
  | { type: "CONTEXTOS_REQUEST_STATE" };

export type BackgroundToSidePanelMessage =
  | { type: "CONTEXTOS_STATE_UPDATE"; payload: TabWatchState | null }
  | { type: "CONTEXTOS_EXTENSION_STATUS"; payload: { message: string } };

export type RuntimeMessage =
  | ContentToBackgroundMessage
  | SidePanelToBackgroundMessage
  | BackgroundToSidePanelMessage;
