import { Activity, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleAlert, Clock3, Compass, HelpCircle, Link2, Play, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeVideo, generateBridge, getContextManifest } from "../services/contextosApi";
import { buildBridgeRequest, createBridgeCacheKey, fallbackBridgeResponse, isStaleBridgeResponse, shouldRequestBridge } from "../services/bridgeSession";
import { buildRepairBridgeRequest, diagnoseRepairCandidate, type RepairCandidate } from "../services/contextRepair";
import { getProfile, markConceptKnown, markConceptNeedsSimpler, resetProfile, saveProfile, type LocalContextProfile, type LocalGoal } from "../services/profileStorage";
import type { BridgeResponse, ConceptSegment, ContextManifest } from "../types/api";
import type { BackgroundToSidePanelMessage, SidePanelToBackgroundMessage, TabWatchState } from "../types/messages";
import { createCurrentContextViewModel } from "../utils/currentContextViewModel";
import { getWhyNowReasons, shouldShowWhyNow } from "../utils/whyNow";

type ApiStatus = "idle" | "analyzing" | "ready" | "error";
type BridgeState = {
  key: string | null;
  segmentId: string | null;
  response: BridgeResponse | null;
  loading: boolean;
  simplerLoading: boolean;
};
type RepairState = {
  active: boolean;
  candidate: RepairCandidate | null;
  response: BridgeResponse | null;
  loading: boolean;
  error: string | null;
};

export function App() {
  const [state, setState] = useState<TabWatchState | null>(null);
  const [connected, setConnected] = useState(false);
  const [manifest, setManifest] = useState<ContextManifest | null>(null);
  const [profile, setProfile] = useState<LocalContextProfile | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [acknowledgedConceptKey, setAcknowledgedConceptKey] = useState<string | null>(null);
  const [whyNowOpen, setWhyNowOpen] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>({
    key: null,
    segmentId: null,
    response: null,
    loading: false,
    simplerLoading: false
  });
  const bridgeCacheRef = useRef(new Map<string, BridgeResponse>());
  const repairCacheRef = useRef(new Map<string, BridgeResponse>());
  const manifestCacheRef = useRef(new Map<string, ContextManifest>());
  const manifestRequestRef = useRef(new Map<string, Promise<ContextManifest>>());
  const bridgeRequestKeyRef = useRef<string | null>(null);
  const repairRequestKeyRef = useRef<string | null>(null);
  const sidePanelPortRef = useRef<chrome.runtime.Port | null>(null);
  const [repairState, setRepairState] = useState<RepairState>({
    active: false,
    candidate: null,
    response: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "contextos-sidepanel" });
    sidePanelPortRef.current = port;
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
      sidePanelPortRef.current = null;
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
  const activeBridgeResponse = !isQuiet && segment && bridgeState.segmentId === segment.id ? bridgeState.response : null;
  const activeExplanation = activeBridgeResponse?.explanation ?? contextView.explanation;
  const bridgeLoading = Boolean(segment && bridgeState.segmentId === segment.id && bridgeState.loading);
  const simplerLoading = Boolean(segment && bridgeState.segmentId === segment.id && bridgeState.simplerLoading);
  const whyNowVisible = contextView.status === "ACTIVE" && shouldShowWhyNow({
    policyDecision: contextView.policy.decision,
    contentMode: manifest?.contentMode ?? "LEARNING"
  });

  useEffect(() => {
    if (!state?.videoId || state.status !== "WATCHING") {
      setManifest(null);
      setApiStatus("idle");
      setApiError(null);
      return;
    }

    const controller = new AbortController();
    const videoId = state.videoId;
    const cachedManifest = manifestCacheRef.current.get(videoId);
    setApiStatus(cachedManifest ? manifestStatus(cachedManifest) : "analyzing");
    setApiError(null);
    setManifest(cachedManifest ?? null);

    loadManifest({
      videoId,
      url: state.url,
      title: state.title ?? state.pageTitle,
      cache: manifestCacheRef.current,
      inFlight: manifestRequestRef.current
    })
      .then((loadedManifest) => {
        if (controller.signal.aborted) {
          return;
        }
        setManifest(loadedManifest);
        setApiStatus(manifestStatus(loadedManifest));
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }
        const fallback = manifestCacheRef.current.get(videoId);
        setManifest(fallback ?? null);
        setApiStatus("error");
        setApiError("Context isn't available for this video right now.");
        console.warn("[ContextOS] Manifest load failed", error);
      });

    return () => controller.abort();
  }, [state?.videoId, state?.status, state?.url, state?.title, state?.pageTitle]);

  useEffect(() => {
    setFeedbackMessage(null);
    setAcknowledgedConceptKey(null);
    setWhyNowOpen(false);
    repairRequestKeyRef.current = null;
    setRepairState({
      active: false,
      candidate: null,
      response: null,
      loading: false,
      error: null
    });
  }, [contextView.conceptKey, state?.videoId]);

  useEffect(() => {
    const videoId = state?.videoId ?? null;
    if (!shouldRequestBridge({
      videoId,
      segment,
      conceptKey: contextView.conceptKey,
      policyDecision: contextView.policy.decision
    }) || !videoId || !segment || !contextView.conceptKey) {
      bridgeRequestKeyRef.current = null;
      setBridgeState({
        key: null,
        segmentId: null,
        response: null,
        loading: false,
        simplerLoading: false
      });
      return;
    }

    const request = buildBridgeRequest({
      videoId,
      segment,
      conceptKey: contextView.conceptKey,
      profile,
      variant: "DEFAULT",
      goal: profile?.goal ?? "UNDERSTAND"
    });
    const cacheKey = createBridgeCacheKey(request, contextView.conceptKey);
    const cached = bridgeCacheRef.current.get(cacheKey);
    if (cached) {
      setBridgeState({
        key: cacheKey,
        segmentId: segment.id,
        response: cached,
        loading: false,
        simplerLoading: false
      });
      return;
    }

    if (bridgeRequestKeyRef.current === cacheKey) {
      return;
    }

    const controller = new AbortController();
    bridgeRequestKeyRef.current = cacheKey;
    setBridgeState({
      key: cacheKey,
      segmentId: segment.id,
      response: fallbackBridgeResponse(segment),
      loading: true,
      simplerLoading: false
    });

    generateBridge(request, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || isStaleBridgeResponse(cacheKey, bridgeRequestKeyRef.current)) {
          return;
        }
        bridgeCacheRef.current.set(cacheKey, response);
        setBridgeState({
          key: cacheKey,
          segmentId: segment.id,
          response,
          loading: false,
          simplerLoading: false
        });
      })
      .catch(() => {
        if (controller.signal.aborted || isStaleBridgeResponse(cacheKey, bridgeRequestKeyRef.current)) {
          return;
        }
        setBridgeState({
          key: cacheKey,
          segmentId: segment.id,
          response: fallbackBridgeResponse(segment),
          loading: false,
          simplerLoading: false
        });
      });

    return () => controller.abort();
  }, [state?.videoId, segment?.id, contextView.conceptKey, contextView.policy.decision, profile]);

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

  async function makeCurrentConceptSimpler() {
    if (!segment || !state?.videoId || !contextView.conceptKey || simplerLoading) {
      return;
    }

    const nextProfile = await markConceptNeedsSimpler(segment);
    setProfile(nextProfile);
    setFeedbackMessage("Making this simpler...");

    const request = buildBridgeRequest({
      videoId: state.videoId,
      segment,
      conceptKey: contextView.conceptKey,
      profile: nextProfile,
      variant: "SIMPLER",
      goal: nextProfile.goal
    });
    const cacheKey = createBridgeCacheKey(request, contextView.conceptKey);
    const cached = bridgeCacheRef.current.get(cacheKey);
    if (cached) {
      setBridgeState({
        key: cacheKey,
        segmentId: segment.id,
        response: cached,
        loading: false,
        simplerLoading: false
      });
      setFeedbackMessage("Simpler explanation loaded.");
      return;
    }

    bridgeRequestKeyRef.current = cacheKey;
    setBridgeState((current) => ({
      key: cacheKey,
      segmentId: segment.id,
      response: current.segmentId === segment.id ? current.response ?? fallbackBridgeResponse(segment) : fallbackBridgeResponse(segment),
      loading: false,
      simplerLoading: true
    }));

    try {
      const response = await generateBridge(request);
      if (isStaleBridgeResponse(cacheKey, bridgeRequestKeyRef.current)) {
        return;
      }
      bridgeCacheRef.current.set(cacheKey, response);
      setBridgeState({
        key: cacheKey,
        segmentId: segment.id,
        response,
        loading: false,
        simplerLoading: false
      });
      setFeedbackMessage("Simpler explanation loaded.");
    } catch {
      if (isStaleBridgeResponse(cacheKey, bridgeRequestKeyRef.current)) {
        return;
      }
      setBridgeState((current) => ({
        ...current,
        loading: false,
        simplerLoading: false
      }));
      setFeedbackMessage("Kept the current explanation.");
    }
  }

  function openRepair() {
    const candidate = diagnoseRepairCandidate({
      manifest,
      segment,
      profile,
      currentTimestamp: state?.currentTimeSeconds ?? null
    });
    repairRequestKeyRef.current = null;
    setRepairState({
      active: true,
      candidate,
      response: null,
      loading: false,
      error: null
    });
    setFeedbackMessage(null);
  }

  function closeRepair() {
    repairRequestKeyRef.current = null;
    setRepairState({
      active: false,
      candidate: null,
      response: null,
      loading: false,
      error: null
    });
  }

  function jumpToRepairTimestamp() {
    const seconds = repairState.candidate?.earlierTimestamp;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
      return;
    }

    const message: SidePanelToBackgroundMessage = {
      type: "CONTEXTOS_SEEK",
      seconds
    };
    sidePanelPortRef.current?.postMessage(message);
  }

  async function explainRepairHere() {
    const candidate = repairState.candidate;
    if (!candidate || !segment || !state?.videoId || repairState.loading) {
      return;
    }

    const request = buildRepairBridgeRequest({
      videoId: state.videoId,
      currentSegment: segment,
      candidate,
      profile,
      goal: profile?.goal ?? "UNDERSTAND"
    });
    const cacheKey = createBridgeCacheKey(request, candidate.conceptKey);
    const cached = repairCacheRef.current.get(cacheKey);
    if (cached) {
      setRepairState((current) => ({
        ...current,
        response: cached,
        loading: false,
        error: null
      }));
      return;
    }

    repairRequestKeyRef.current = cacheKey;
    setRepairState((current) => ({
      ...current,
      response: current.response ?? fallbackRepairResponse(candidate, segment),
      loading: true,
      error: null
    }));

    try {
      const response = await generateBridge(request);
      if (isStaleBridgeResponse(cacheKey, repairRequestKeyRef.current)) {
        return;
      }
      repairCacheRef.current.set(cacheKey, response);
      setRepairState((current) => ({
        ...current,
        response,
        loading: false,
        error: null
      }));
    } catch {
      if (isStaleBridgeResponse(cacheKey, repairRequestKeyRef.current)) {
        return;
      }
      setRepairState((current) => ({
        ...current,
        response: fallbackRepairResponse(candidate, segment),
        loading: false,
        error: "ContextOS could not generate a repair explanation, so it kept the local fallback."
      }));
    }
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

      {repairState.active ? (
        <section className="repair-view" aria-labelledby="repair-heading">
          <button className="back-button" type="button" onClick={closeRepair}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
          <div className="repair-alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <span>You may be missing:</span>
              <h1 id="repair-heading">{repairState.candidate?.canonicalName ?? "Current context"}</h1>
              <p>{repairState.candidate ? repairReasonCopy(repairState.candidate) : "ContextOS needs an active analyzed segment before it can diagnose what is missing."}</p>
            </div>
          </div>

          <div className="repair-explanation">
            <BookOpen size={18} aria-hidden="true" />
            <div>
              <h2>{repairState.response ? "Quick explanation" : "Local diagnosis"}</h2>
              <p>{repairState.response?.explanation ?? repairLocalCopy(repairState.candidate)}</p>
              {repairState.loading ? <p className="feedback-note" role="status">Generating a focused repair...</p> : null}
              {repairState.error ? <p className="feedback-note" role="status">{repairState.error}</p> : null}
            </div>
          </div>

          <div className="repair-actions">
            <button className="repair-primary" type="button" onClick={explainRepairHere} disabled={!repairState.candidate || !segment || repairState.loading}>
              <Play size={15} aria-hidden="true" />
              {repairState.loading ? "Explaining..." : "Explain this here"}
            </button>
            {typeof repairState.candidate?.earlierTimestamp === "number" ? (
              <button className="repair-secondary" type="button" onClick={jumpToRepairTimestamp}>
                <Link2 size={16} aria-hidden="true" />
                <span>Jump to {formatTime(repairState.candidate.earlierTimestamp)}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <>
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

          {contextView.status === "ACTIVE" || isAcknowledged || Boolean(feedbackMessage) ? <section className="context-preview">
            <div className="section-label">
              <Sparkles size={15} aria-hidden="true" />
              <span>Personal Context</span>
            </div>
            <h2>{isAcknowledged ? "Got it" : isQuiet ? "Quiet mode" : segment ? `${currentSegmentComfortable ? "comfortable · " : ""}${segment.difficulty.toLowerCase()} · ${segment.importance.toLowerCase()} importance` : "Analyzing concept timeline"}</h2>
            <p>
              {isAcknowledged ? "I'll avoid explaining this level again." : isFailed ? "Context isn't available right now." : isQuiet ? "No extra context needed right now." : activeExplanation}
            </p>
            {bridgeLoading ? <p className="feedback-note" role="status">Personalizing this explanation...</p> : null}
            {feedbackMessage ? <p className="feedback-note" role="status">{feedbackMessage}</p> : null}
            {contextView.status === "ACTIVE" ? (
              <div className="button-row" aria-label="Context actions">
                <button className={currentSegmentComfortable ? "active-action" : ""} type="button" onClick={markCurrentConceptKnown} disabled={!segment}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  I know this
                </button>
                <button type="button" onClick={makeCurrentConceptSimpler} disabled={!segment || simplerLoading}>
                  <WandSparkles size={14} aria-hidden="true" />
                  {simplerLoading ? "Making simpler..." : "Simpler"}
                </button>
              </div>
            ) : null}
          </section> : null}

          {whyNowVisible && segment ? <section className="why-card">
            <div className="section-label">
              <Compass size={15} aria-hidden="true" />
              <button className="inline-disclosure" type="button" onClick={() => setWhyNowOpen((open) => !open)} aria-expanded={whyNowOpen}>
                Why now? {whyNowOpen ? "⌃" : "⌄"}
              </button>
            </div>
            {whyNowOpen ? (
              <>
                <h2>Why this appeared</h2>
                <ul>
                  {getWhyNowReasons({
                    policy: contextView.policy,
                    contentMode: manifest?.contentMode ?? "LEARNING",
                    knowledgeState: contextView.knowledgeState,
                    bridgeResponse: activeBridgeResponse,
                    profile
                  }).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section> : null}

          {contextView.status === "ACTIVE" ? <section className="repair-card">
            <div className="repair-copy">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <h2>I'm lost</h2>
                <p>Find what I'm missing</p>
              </div>
            </div>
            <button className="repair-button" type="button" onClick={openRepair} disabled={!manifest || !segment}>
              <HelpCircle size={16} aria-hidden="true" />
              Diagnose
            </button>
          </section> : null}
        </>
      )}

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

function manifestStatus(manifest: ContextManifest): ApiStatus {
  if (manifest.status === "READY" || manifest.status === "NO_CONTEXT_REQUIRED") {
    return "ready";
  }
  if (manifest.status === "FAILED") {
    return "error";
  }
  return "analyzing";
}

function loadManifest({
  videoId,
  url,
  title,
  cache,
  inFlight
}: {
  videoId: string;
  url: string;
  title: string | null;
  cache: Map<string, ContextManifest>;
  inFlight: Map<string, Promise<ContextManifest>>;
}): Promise<ContextManifest> {
  const cached = cache.get(videoId);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingRequest = inFlight.get(videoId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = getContextManifest(videoId)
    .then((existing) => existing ?? analyzeVideo(url, title))
    .then((loadedManifest) => {
      if (loadedManifest.status === "READY" || loadedManifest.status === "NO_CONTEXT_REQUIRED") {
        cache.set(videoId, loadedManifest);
      }
      return loadedManifest;
    })
    .finally(() => {
      inFlight.delete(videoId);
    });

  inFlight.set(videoId, request);
  return request;
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

function repairReasonCopy(candidate: RepairCandidate): string {
  if (candidate.relationship === "DIRECT_PREREQUISITE") {
    return `This section depends on ${candidate.canonicalName}, and your profile marks it as ${candidate.knowledgeState.toLowerCase()}.`;
  }
  if (candidate.relationship === "INDIRECT_PREREQUISITE") {
    return `A prerequisite behind this section depends on ${candidate.canonicalName}, so ContextOS is checking that foundation first.`;
  }
  if (candidate.reason === "NO_CLEAR_PREREQUISITE") {
    return "ContextOS did not find a clear missing prerequisite, so it will simplify the current idea instead.";
  }
  return `The current concept, ${candidate.canonicalName}, still looks incomplete in your profile.`;
}

function repairLocalCopy(candidate: RepairCandidate | null): string {
  if (!candidate) {
    return "Open an analyzed part of the video, then try repair again.";
  }
  if (candidate.reason === "NO_CLEAR_PREREQUISITE") {
    return "No specific missing prerequisite was found. Try a simpler explanation of the current idea.";
  }
  return `${candidate.canonicalName} is the best local repair target. ContextOS picked it without contacting Gemini.`;
}

function fallbackRepairResponse(candidate: RepairCandidate, segment: ConceptSegment): BridgeResponse {
  return {
    concept: candidate.canonicalName,
    explanation: `${candidate.canonicalName} is background for understanding ${segment.concept}. Keep the basic idea in mind, then continue this section.`,
    personalized: false,
    anchorUsed: null
  };
}
