import { Activity, CheckCircle2, CircleAlert, Clock3, Compass, HelpCircle, Play, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyzeVideo, getContextManifest } from "../services/contextosApi";
import { getProfile, markConceptKnown, resetProfile, saveProfile, type LocalContextProfile, type LocalGoal } from "../services/profileStorage";
import type { ConceptSegment, ContextManifest } from "../types/api";
import type { BackgroundToSidePanelMessage, TabWatchState } from "../types/messages";
import { createCurrentContextViewModel } from "../utils/currentContextViewModel";
import type { ContextPolicyReason } from "../utils/contextPolicy";

type ApiStatus = "idle" | "analyzing" | "ready" | "error";

export function App() {
  const [state, setState] = useState<TabWatchState | null>(null);
  const [connected, setConnected] = useState(false);
  const [manifest, setManifest] = useState<ContextManifest | null>(null);
  const [profile, setProfile] = useState<LocalContextProfile | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [acknowledgedConceptKey, setAcknowledgedConceptKey] = useState<string | null>(null);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "contextos-sidepanel" });
    setConnected(true);

    port.postMessage({ type: "CONTEXTOS_SIDE_PANEL_READY" });

    port.onMessage.addListener((message: BackgroundToSidePanelMessage) => {
      if (message.type === "CONTEXTOS_STATE_UPDATE") {
        setState(message.payload);
      }
    });

    port.onDisconnect.addListener(() => {
      setConnected(false);
    });

    const refreshId = window.setInterval(() => {
      port.postMessage({ type: "CONTEXTOS_REQUEST_STATE" });
    }, 3000);

    return () => {
      window.clearInterval(refreshId);
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
    Object.assign(globalThis, {
      contextosProfile: {
        getProfile,
        resetProfile
      }
    });
  }, []);

  const watchStatus = useMemo(() => getStatusCopy(state), [state]);
  const timestamp = formatTime(state?.currentTimeSeconds ?? null);
  const duration = formatTime(state?.durationSeconds ?? null);
  const contextView = createCurrentContextViewModel({
    manifest,
    profile,
    timestampSeconds: state?.currentTimeSeconds ?? null,
    apiStatus,
    apiError,
    hasVideo: Boolean(state?.videoId)
  });
  const segment = contextView.segment;
  const isAcknowledged = Boolean(contextView.conceptKey && contextView.conceptKey === acknowledgedConceptKey);
  const isQuiet = contextView.status === "QUIET" || isAcknowledged;
  const isFailed = contextView.status === "FAILED";
  const currentSegmentComfortable = contextView.knowledgeState === "COMFORTABLE";

  useEffect(() => {
    if (!state?.videoId || state.status !== "WATCHING") {
      setManifest(null);
      setApiStatus("idle");
      setApiError(null);
      return;
    }

    const controller = new AbortController();
    setApiStatus("analyzing");
    setApiError(null);
    setManifest(null);

    getContextManifest(state.videoId)
      .then((existing) => existing ?? analyzeVideo(state.url, state.title ?? state.pageTitle))
      .then((loadedManifest) => {
        if (controller.signal.aborted) {
          return;
        }
        setManifest(loadedManifest);
        setApiStatus(loadedManifest.status === "READY" || loadedManifest.status === "NO_CONTEXT_REQUIRED" ? "ready" : loadedManifest.status === "FAILED" ? "error" : "analyzing");
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }
        setManifest(null);
        setApiStatus("error");
        setApiError(error.message);
      });

    return () => controller.abort();
  }, [state?.videoId, state?.status, state?.url, state?.title, state?.pageTitle]);

  useEffect(() => {
    setFeedbackMessage(null);
    setAcknowledgedConceptKey(null);
  }, [contextView.conceptKey, state?.videoId]);

  async function markCurrentConceptKnown() {
    if (!segment) {
      return;
    }

    const nextProfile = await markConceptKnown(segment);
    setProfile(nextProfile);
    if (contextView.conceptKey) {
      setAcknowledgedConceptKey(contextView.conceptKey);
    }
    setFeedbackMessage("Got it. I'll avoid explaining this level again.");
  }

  async function changeGoal(goal: LocalGoal) {
    const current = profile ?? await getProfile();
    const nextProfile = { ...current, goal };
    await saveProfile(nextProfile);
    setProfile(nextProfile);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <div className="brand-row">
            <span className="brand-mark">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <span className="brand-name">ContextOS</span>
          </div>
          <p>Explaining only what you need</p>
        </div>
        <div className="status-pill" aria-label={connected ? "ContextOS active" : "ContextOS reconnecting"}>
          <span className={connected ? "status-dot active" : "status-dot"} />
          Active
        </div>
      </header>

      <section className="goal-card" aria-label="Learning goal">
        <Clock3 size={17} aria-hidden="true" />
        <label htmlFor="goal-select">Goal</label>
        <select id="goal-select" value={profile?.goal ?? "UNDERSTAND"} onChange={(event) => changeGoal(event.target.value as LocalGoal)}>
          <option value="UNDERSTAND">Understand</option>
          <option value="INTERVIEW">Interview</option>
          <option value="BUILD">Build</option>
        </select>
      </section>

      <section className="live-card" aria-labelledby="live-context-heading">
        <div className="section-label">
          <Activity size={15} aria-hidden="true" />
          <span id="live-context-heading">Live Context</span>
        </div>
        <div className="time-row">
          <span>{timestamp}</span>
          <span>{duration ? `/ ${duration}` : ""}</span>
        </div>
        <h1>{getMainHeading({ apiStatus, isFailed, isQuiet, segment, hasVideo: Boolean(state?.videoId) })}</h1>
        <p className="summary">{isAcknowledged ? "No extra context needed." : getMainSummary({ apiStatus, apiError, isFailed, isQuiet, segment, watchStatus, contextViewExplanation: contextView.explanation })}</p>
      </section>

      <section className="context-preview">
        <div className="section-label">
          <Sparkles size={15} aria-hidden="true" />
          <span>Personal Context</span>
        </div>
        <h2>{isAcknowledged ? "Got it" : isQuiet ? "Quiet mode" : segment ? `${currentSegmentComfortable ? "comfortable · " : ""}${segment.difficulty.toLowerCase()} · ${segment.importance.toLowerCase()} importance` : "Analyzing concept timeline"}</h2>
        <p>
          {isAcknowledged ? "I'll avoid explaining this level again." : isFailed ? "Context isn't available right now." : isQuiet ? "No extra context needed right now." : contextView.explanation}
        </p>
        {feedbackMessage ? <p className="feedback-note" role="status">{feedbackMessage}</p> : null}
        {contextView.status === "ACTIVE" ? (
          <div className="button-row" aria-label="Context actions">
            <button className={currentSegmentComfortable ? "active-action" : ""} type="button" onClick={markCurrentConceptKnown} disabled={!segment}>
              <CheckCircle2 size={14} aria-hidden="true" />
              I know this
            </button>
            <button type="button" disabled title="Simpler explanations start after Day 4.">
              <WandSparkles size={14} aria-hidden="true" />
              Simpler
            </button>
          </div>
        ) : null}
      </section>

      {contextView.status === "ACTIVE" && segment ? <section className="why-card">
        <div className="section-label">
          <Compass size={15} aria-hidden="true" />
          <span>Why now?</span>
        </div>
        <ul>
          {getPolicyReasonCopy(contextView.policy.reasonCodes, manifest?.contentMode ?? "LEARNING").map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section> : null}

      <section className="repair-card">
        <div className="repair-copy">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <h2>I'm lost</h2>
            <p>Find what I'm missing</p>
          </div>
        </div>
        <button className="repair-button" type="button" disabled title="Context Repair starts later.">
          <HelpCircle size={16} aria-hidden="true" />
          Coming soon
        </button>
      </section>

      <footer>
        <Play size={13} aria-hidden="true" />
        <span>{state?.url ? shortUrl(state.url) : "Waiting for YouTube state"}</span>
      </footer>
    </main>
  );
}

function getStatusCopy(state: TabWatchState | null): string {
  if (!state) {
    return "Open a YouTube watch page, then use the extension icon to bring ContextOS beside the video.";
  }

  if (state.status === "NO_VIDEO_ELEMENT") {
    return "The watch page is visible, but the video element is still loading.";
  }

  if (state.status === "NOT_YOUTUBE_WATCH") {
    return "ContextOS is quiet until you open a YouTube watch page.";
  }

  return "YouTube signal is live. ContextOS is ready to ask the backend for the current concept.";
}

function getMainHeading({
  apiStatus,
  isFailed,
  isQuiet,
  segment,
  hasVideo
}: {
  apiStatus: ApiStatus;
  isFailed: boolean;
  isQuiet: boolean;
  segment: ConceptSegment | null;
  hasVideo: boolean;
}): string {
  if (isFailed) {
    return "Context isn't available right now.";
  }
  if (apiStatus === "analyzing") {
    return "Analyzing this video...";
  }
  if (isQuiet) {
    return "No extra context needed.";
  }
  if (segment) {
    return segment.concept;
  }
  return hasVideo ? "YouTube video detected" : "Open a YouTube video";
}

function getMainSummary({
  apiStatus,
  apiError,
  isFailed,
  isQuiet,
  segment,
  watchStatus,
  contextViewExplanation
}: {
  apiStatus: ApiStatus;
  apiError: string | null;
  isFailed: boolean;
  isQuiet: boolean;
  segment: ConceptSegment | null;
  watchStatus: string;
  contextViewExplanation: string;
}): string {
  if (isFailed) {
    return apiError ?? "The saved context manifest is unavailable or analysis failed.";
  }
  if (apiStatus === "analyzing") {
    return "ContextOS is creating or loading the Context Manifest once.";
  }
  if (isQuiet) {
    return "You likely already have enough context for this part of the video.";
  }
  return segment ? contextViewExplanation : watchStatus;
}

function getPolicyReasonCopy(reasons: ContextPolicyReason[], contentMode: ContextManifest["contentMode"]): string[] {
  const copy = reasons.flatMap((reason): string[] => {
    switch (reason) {
      case "UNKNOWN_CORE_CONCEPT":
        return ["This is a core concept you have not marked as known yet."];
      case "UNKNOWN_HIGH_IMPORTANCE_CONCEPT":
        return ["This high-importance idea looks new for your profile."];
      case "MISSING_PREREQUISITE":
        return ["A prerequisite concept may still need reinforcement."];
      case "LEARNING_THRESHOLD_MET":
        return ["The learning-mode knowledge gap is high enough to explain."];
      case "CONTEXTUAL_THRESHOLD_MET":
        return ["The stricter contextual-mode threshold is high enough to explain."];
      case "LOW_KNOWLEDGE_GAP":
      case "CONTEXTUAL_THRESHOLD_NOT_MET":
      case "VIEWER_ALREADY_COMFORTABLE":
      case "PASSIVE_CONTENT":
      case "NO_CONTEXT_REQUIRED":
      case "ANALYSIS_FAILED":
      case "NO_MEANINGFUL_CONCEPT":
        return [];
    }
  });

  if (copy.length > 0) {
    return copy;
  }

  return [
    "This timestamp is inside a saved Context Manifest segment.",
    `Context mode is ${contentMode.toLowerCase()}.`
  ];
}

function formatTime(seconds: number | null): string {
  if (seconds === null) {
    return "00:00";
  }

  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function shortUrl(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    return `${url.hostname}${url.pathname}${url.search}`;
  } catch {
    return urlValue;
  }
}
