/**
 * Dev-mode entry point for browser-based prototype testing.
 */

import { Session } from "@m2c2kit/session";
import { Embedding } from "@m2c2kit/embedding";
import { LocalDatabase } from "@m2c2kit/db";
import { ColorDots } from "@m2c2kit/assessment-color-dots";
import { ColorShapes } from "@m2c2kit/assessment-color-shapes";
import { GridMemory } from "@m2c2kit/assessment-grid-memory";
import { SymbolSearch } from "@m2c2kit/assessment-symbol-search";
import type { StudyProtocol } from "../../contracts/study-protocol.schema";

// Stub out Capacitor global so @capacitor/core doesn't crash in browser
(window as any).Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => "web",
  isPluginAvailable: () => false,
};

// ---------------------------------------------------------------------------
// Demo study protocol
// ---------------------------------------------------------------------------

const DEV_PROTOCOL: StudyProtocol = {
  study_id: "dev-study",
  study_uuid: crypto.randomUUID(),
  version: 1,
  schedule: {
    windows: [{ start: "09:00", end: "21:00" }],
    prompts_per_day: 5,
    randomize_within_window: true,
    expiry_minutes: 30,
    days_total: 14,
    min_gap_minutes: 30,
  },
  assessments: [
    {
      activity_id: "color-dots",
      activity_version: "latest",
      parameters: { number_of_trials: 3, scoring: true },
      selection_strategy: "round_robin",
      order: 0,
    },
    {
      activity_id: "color-shapes",
      activity_version: "latest",
      // number_of_different_colors_trials must be <= number_of_trials
      parameters: {
        number_of_trials: 3,
        number_of_different_colors_trials: 2,
        scoring: true,
      },
      selection_strategy: "round_robin",
      order: 1,
    },
    {
      activity_id: "grid-memory",
      activity_version: "latest",
      parameters: { number_of_trials: 3, scoring: true },
      selection_strategy: "round_robin",
      order: 2,
    },
    {
      activity_id: "symbol-search",
      activity_version: "latest",
      parameters: { number_of_trials: 3, scoring: true },
      selection_strategy: "round_robin",
      order: 3,
    },
  ],
  context_collection: {
    gps_on_prompt: false,
    gps_interval_minutes: null,
    collect_battery: false,
    collect_network_type: true,
  },
};

// ---------------------------------------------------------------------------
// Assessment factory
// ---------------------------------------------------------------------------

type AnyAssessment = ColorDots | ColorShapes | GridMemory | SymbolSearch;

const ASSESSMENT_MAP: Record<string, () => AnyAssessment> = {
  "color-dots": () => new ColorDots(),
  "color-shapes": () => new ColorShapes(),
  "grid-memory": () => new GridMemory(),
  "symbol-search": () => new SymbolSearch(),
};

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

let currentSession: Session | null = null;

function setStatus(text: string) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}

function setRunning(running: boolean) {
  (document.getElementById("assessment-picker") as HTMLSelectElement).disabled =
    running;
  (document.getElementById("btn-start") as HTMLButtonElement).disabled =
    running;
  (document.getElementById("btn-instructions") as HTMLButtonElement).disabled =
    running;
  (document.getElementById("btn-stop") as HTMLButtonElement).disabled =
    !running;
}

function clearCanvas() {
  const app = document.getElementById("app");
  if (app) app.innerHTML = "";
}

function resetToIdle() {
  currentSession = null;
  setRunning(false);
  clearCanvas();
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function launchSession(assessmentId: string, showInstructions: boolean) {
  if (currentSession) return;

  const promptId = crypto.randomUUID();
  const assessment = ASSESSMENT_MAP[assessmentId]?.();
  if (!assessment) {
    console.error(`[Dev] Unknown assessment: ${assessmentId}`);
    return;
  }

  const assessmentConfig = DEV_PROTOCOL.assessments.find(
    (a) => a.activity_id === assessmentId,
  );

  // setParameters takes raw values and wraps them in { default: v } internally
  assessment.setParameters({
    ...(assessmentConfig?.parameters ?? {}),
    prompt_id: promptId,
    show_instructions: showInstructions,
  });

  currentSession = new Session({
    activities: [assessment],
    dataStores: [new LocalDatabase()],
    rootElementId: "app",
  });

  // In browser, Embedding sets autoStartAfterInit=true — session starts
  // automatically once initialize() finishes. No manual start() call needed.
  Embedding.initialize(currentSession, { host: "MobileWebView" });

  setRunning(true);
  setStatus(`loading ${assessmentId}…`);

  currentSession.onStart(() => {
    setStatus(`running — ${assessmentId}`);
    console.log(`[Dev] Session started | prompt_id=${promptId}`);
  });

  // onEnd fires for both normal completion AND quit/cancel.
  // (Activity cancel → session.end() → SessionEnd event)
  currentSession.onEnd(() => {
    console.log("[Dev] Session ended");
    setStatus("done — pick another assessment");
    resetToIdle();
  });

  try {
    await currentSession.initialize();
    console.log(`[Dev] Initialized | ${assessmentId} | prompt_id=${promptId}`);
  } catch (err) {
    console.error(`[Dev] Failed to initialize ${assessmentId}:`, err);
    setStatus(`error: ${(err as Error).message ?? String(err)}`);
    resetToIdle();
  }
}

function stopSession() {
  if (currentSession) currentSession.end();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

document.getElementById("btn-start")?.addEventListener("click", () => {
  const picker = document.getElementById(
    "assessment-picker",
  ) as HTMLSelectElement;
  launchSession(picker.value, false);
});

document.getElementById("btn-instructions")?.addEventListener("click", () => {
  const picker = document.getElementById(
    "assessment-picker",
  ) as HTMLSelectElement;
  launchSession(picker.value, true);
});

document.getElementById("btn-stop")?.addEventListener("click", stopSession);

setStatus("idle — pick an assessment");
console.log("[Dev] EMA prototype ready.");
