/**
 * Dev-mode entry point for browser-based prototype testing.
 * Mocks the Capacitor native bridge so m2c2kit sessions can be launched
 * directly in a desktop browser without a device or native shell.
 *
 * Run: npm run serve (Vite) then open http://localhost:5173/dev.html
 */
import { Session } from "@m2c2kit/session";
import { Embedding } from "@m2c2kit/embedding";
import { LocalDatabase } from "@m2c2kit/db";
import { ColorDots } from "@m2c2kit/assessment-color-dots";
import { ColorShapes } from "@m2c2kit/assessment-color-shapes";
import { GridMemory } from "@m2c2kit/assessment-grid-memory";
import { SymbolSearch } from "@m2c2kit/assessment-symbol-search";
// ---------------------------------------------------------------------------
// Mock native bridge — dispatches CustomEvents on window instead of Capacitor
// ---------------------------------------------------------------------------
function dispatchNativeEvent(event) {
  window.dispatchEvent(new CustomEvent("nativeEvent", { detail: event }));
}
// Stub out Capacitor global so @capacitor/core doesn't crash in browser
window.Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => "web",
  isPluginAvailable: () => false,
};
// ---------------------------------------------------------------------------
// Demo study protocol
// ---------------------------------------------------------------------------
const DEV_PROTOCOL = {
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
      parameters: { number_of_trials: 3, scoring: true },
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
    gps_on_prompt: false, // GPS not available in browser
    gps_interval_minutes: null,
    collect_battery: false,
    collect_network_type: true,
  },
};
// ---------------------------------------------------------------------------
// Assessment map
// ---------------------------------------------------------------------------
const ASSESSMENT_MAP = {
  "color-dots": () => new ColorDots(),
  "color-shapes": () => new ColorShapes(),
  "grid-memory": () => new GridMemory(),
  "symbol-search": () => new SymbolSearch(),
};
// ---------------------------------------------------------------------------
// Session setup
// ---------------------------------------------------------------------------
let currentSession = null;
function setStatus(text) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}
async function launchSession(assessmentId, showInstructions) {
  if (currentSession) {
    console.warn("[Dev] Session already running");
    return;
  }
  const promptId = crypto.randomUUID();
  const db = new LocalDatabase();
  const assessment = ASSESSMENT_MAP[assessmentId]?.();
  if (!assessment) {
    console.error(`[Dev] Unknown assessment: ${assessmentId}`);
    return;
  }
  // Override parameters from protocol
  const assessmentConfig = DEV_PROTOCOL.assessments.find(
    (a) => a.activity_id === assessmentId,
  );
  if (assessmentConfig?.parameters) {
    assessment.options = {
      ...assessment.options,
      parameters: {
        ...(assessment.options?.parameters ?? {}),
        ...assessmentConfig.parameters,
        prompt_id: { default: promptId },
        show_instructions: { default: showInstructions },
      },
    };
  }
  currentSession = new Session({
    activities: [assessment],
    dataStores: [db],
  });
  Embedding.initialize(currentSession, { host: "MobileWebView" });
  currentSession.onStart(() => {
    setStatus(`running — ${assessmentId}`);
    console.log(`[Dev] Session started | prompt_id=${promptId}`);
  });
  currentSession.onEnd(() => {
    setStatus("completed ✓");
    console.log("[Dev] Session ended");
    console.log("[Dev] Trial data:", db);
    currentSession = null;
  });
  currentSession.onCancel(() => {
    setStatus("canceled");
    console.log("[Dev] Session canceled (quit button)");
    currentSession = null;
  });
  await currentSession.initialize();
  // Simulate the native SESSION_START event
  dispatchNativeEvent({
    type: "SESSION_START",
    prompt_id: promptId,
    protocol: DEV_PROTOCOL,
  });
  console.log(`[Dev] SESSION_START fired | prompt_id=${promptId}`);
}
// ---------------------------------------------------------------------------
// Listen for SESSION_START (mirrors src/index.ts)
// ---------------------------------------------------------------------------
window.addEventListener("nativeEvent", (e) => {
  const event = e.detail;
  if (event.type === "SESSION_START" && currentSession) {
    currentSession.start();
  }
});
// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
document.getElementById("btn-start")?.addEventListener("click", () => {
  const picker = document.getElementById("assessment-picker");
  launchSession(picker.value, false);
});
document
  .getElementById("btn-show-instructions")
  ?.addEventListener("click", () => {
    const picker = document.getElementById("assessment-picker");
    launchSession(picker.value, true);
  });
setStatus("idle — pick an assessment and click ▶");
console.log(
  "[Dev] EMA prototype ready. Use the controls above to launch a session.",
);
