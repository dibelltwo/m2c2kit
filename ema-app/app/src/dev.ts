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
import { Survey } from "@m2c2kit/survey";
import type { StudyProtocol } from "../../contracts/study-protocol.schema";
import { buildEmaSurveyJson } from "./survey-protocol";
import {
  getAssessmentConfigsForPackage,
  getAvailablePackages,
  getDefaultPackage,
  getSurveyConfigForPackage,
} from "./package-protocol";
import {
  extractSurveyItemResponses,
  persistSurveyItemResponses,
} from "./data/survey-response";
import { createDefaultProtocol } from "./setup/default-protocol";
import { loadSavedProtocol, mountSetupUI } from "./setup/setup";

// Stub out Capacitor global so @capacitor/core doesn't crash in browser
(window as any).Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => "web",
  isPluginAvailable: () => false,
};

// ---------------------------------------------------------------------------
// Demo study protocol
// ---------------------------------------------------------------------------

const DEFAULT_PROTOCOL: StudyProtocol = createDefaultProtocol();

// ---------------------------------------------------------------------------
// Assessment factory
// ---------------------------------------------------------------------------

type AnyAssessment =
  | ColorDots
  | ColorShapes
  | GridMemory
  | SymbolSearch
  | Survey;

const ASSESSMENT_MAP: Record<string, () => AnyAssessment> = {
  "color-dots": () => new ColorDots(),
  "color-shapes": () => new ColorShapes(),
  "grid-memory": () => new GridMemory(),
  "symbol-search": () => new SymbolSearch(),
  "ema-survey": () =>
    new Survey(
      buildEmaSurveyJson(currentProtocol.ema_survey, {
        protocol_version: currentProtocol.version,
      }),
    ),
};

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

let currentSession: Session | null = null;
let currentProtocol: StudyProtocol = loadSavedProtocol() ?? DEFAULT_PROTOCOL;

function setStatus(text: string) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}

function setRunning(running: boolean) {
  (document.getElementById("assessment-picker") as HTMLSelectElement).disabled =
    running;
  (document.getElementById("btn-start") as HTMLButtonElement).disabled =
    running;
  (document.getElementById("btn-start-prompt") as HTMLButtonElement).disabled =
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

function renderStandby() {
  const app = document.getElementById("app");
  if (!app || currentSession) return;
  const packages = getAvailablePackages(currentProtocol);
  app.classList.remove("survey-mode");
  app.classList.remove("setup-mode");
  app.classList.add("standby-mode");
  app.innerHTML = `
    <section class="standby-shell">
      <h2>Participant Standby</h2>
      <p><strong>Study ID:</strong> ${currentProtocol.study_id}</p>
      <p><strong>Protocol Version:</strong> ${currentProtocol.version}</p>
      <p>Visible package types are shown below for dev/coordinator review. Use Setup to edit the protocol or launch a specific package from this standby screen.</p>
      <div class="setup-pill-row">
        ${packages
          .map((pkg) => `<span class="setup-pill">${pkg.package_name}</span>`)
          .join("")}
      </div>
      <div class="setup-actions" style="margin-top: 16px;">
        ${packages
          .map(
            (pkg) => `
              <button
                type="button"
                class="primary"
                data-package-launch="${pkg.package_id}"
              >
                Launch ${pkg.package_name}
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;

  app
    .querySelectorAll<HTMLButtonElement>("[data-package-launch]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const packageId = button.dataset.packageLaunch;
        if (!packageId) return;
        void launchPromptSession(false, packageId);
      });
    });
}

function resetToIdle() {
  currentSession = null;
  setRunning(false);
  document.getElementById("app")?.classList.remove("survey-mode");
  document.getElementById("app")?.classList.remove("setup-mode");
  clearCanvas();
  renderStandby();
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

function openSetup() {
  if (currentSession) return;
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.add("setup-mode");
  mountSetupUI(app, currentProtocol, (protocol) => {
    currentProtocol = protocol;
    setStatus(`saved protocol v${protocol.version}`);
    renderStandby();
  });
}

function applyAssessmentParameters(
  game: Exclude<AnyAssessment, Survey>,
  assessmentId: string,
  promptId: string,
  showInstructions: boolean,
  packageId?: string,
) {
  const assessmentConfig = getAssessmentConfigsForPackage(
    currentProtocol,
    packageId,
  ).find((a) => a.activity_id === assessmentId);
  game.setParameters({
    ...(assessmentConfig?.parameters ?? {}),
    prompt_id: promptId,
    protocol_version: currentProtocol.version,
    show_instructions: showInstructions,
  });
}

function createPromptActivities(
  promptId: string,
  showInstructions: boolean,
  packageId?: string,
): AnyAssessment[] {
  const activities: AnyAssessment[] = getAssessmentConfigsForPackage(
    currentProtocol,
    packageId,
  )
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((config) => {
      const activity = ASSESSMENT_MAP[config.activity_id]?.();
      if (!activity || activity instanceof Survey) {
        throw new Error(`Unsupported prompt activity: ${config.activity_id}`);
      }

      applyAssessmentParameters(
        activity,
        config.activity_id,
        promptId,
        showInstructions,
        packageId,
      );
      return activity;
    });

  const survey = new Survey();
  survey.setParameters(
    buildEmaSurveyJson(getSurveyConfigForPackage(currentProtocol, packageId), {
      prompt_id: promptId,
      study_id: currentProtocol.study_id,
      protocol_version: currentProtocol.version,
    }),
  );
  activities.push(survey);

  return activities;
}

async function launchSession(assessmentId: string, showInstructions: boolean) {
  if (currentSession) return;

  const promptId = crypto.randomUUID();
  document.getElementById("app")?.classList.remove("standby-mode");
  const assessment = ASSESSMENT_MAP[assessmentId]?.();
  if (!assessment) {
    console.error(`[Dev] Unknown assessment: ${assessmentId}`);
    return;
  }

  const isSurvey = assessment instanceof Survey;

  if (isSurvey) {
    document.getElementById("app")?.classList.add("survey-mode");
    assessment.setParameters(
      buildEmaSurveyJson(getSurveyConfigForPackage(currentProtocol), {
        prompt_id: promptId,
        study_id: currentProtocol.study_id,
        protocol_version: currentProtocol.version,
      }),
    );
  } else {
    applyAssessmentParameters(
      assessment as Exclude<AnyAssessment, Survey>,
      assessmentId,
      promptId,
      showInstructions,
      undefined,
    );
  }

  const localDb = new LocalDatabase();
  currentSession = new Session({
    activities: [assessment],
    dataStores: [localDb],
    rootElementId: "app",
  });

  currentSession.onActivityData((event) => {
    const surveyResponses = extractSurveyItemResponses(event);
    if (surveyResponses.length > 0) {
      void persistSurveyItemResponses(localDb, surveyResponses);
    }
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

async function launchPromptSession(
  showInstructions: boolean,
  packageId = getDefaultPackage(currentProtocol)?.package_id,
) {
  if (currentSession) return;

  const promptId = crypto.randomUUID();
  const localDb = new LocalDatabase();
  document.getElementById("app")?.classList.remove("standby-mode");

  try {
    currentSession = new Session({
      activities: createPromptActivities(promptId, showInstructions, packageId),
      dataStores: [localDb],
      rootElementId: "app",
    });

    currentSession.onActivityData((event) => {
      const surveyResponses = extractSurveyItemResponses(event);
      if (surveyResponses.length > 0) {
        void persistSurveyItemResponses(localDb, surveyResponses);
      }
    });

    Embedding.initialize(currentSession, { host: "MobileWebView" });
    setRunning(true);
    setStatus(`loading prompt session${packageId ? ` — ${packageId}` : ""}…`);

    currentSession.onStart(() => {
      setStatus(`running — ${packageId ?? "default package"} prompt session`);
      console.log(
        `[Dev] Prompt session started | prompt_id=${promptId} | package_id=${packageId ?? "default"}`,
      );
    });

    currentSession.onEnd(() => {
      console.log("[Dev] Prompt session ended");
      setStatus("done — ready for next prompt");
      resetToIdle();
    });

    await currentSession.initialize();
    console.log(
      `[Dev] Initialized | full prompt session | prompt_id=${promptId} | package_id=${packageId ?? "default"}`,
    );
  } catch (err) {
    console.error("[Dev] Failed to initialize full prompt session:", err);
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

document.getElementById("btn-start-prompt")?.addEventListener("click", () => {
  launchPromptSession(false);
});

document.getElementById("btn-setup")?.addEventListener("click", openSetup);

document.getElementById("btn-instructions")?.addEventListener("click", () => {
  const picker = document.getElementById(
    "assessment-picker",
  ) as HTMLSelectElement;
  launchSession(picker.value, true);
});

document.getElementById("btn-stop")?.addEventListener("click", stopSession);

setStatus("idle — pick an assessment or run a prompt");
renderStandby();
console.log("[Dev] EMA prototype ready.");
