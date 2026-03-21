import { Session } from "@m2c2kit/session";
import { Embedding } from "@m2c2kit/embedding";
import { LocalDatabase } from "@m2c2kit/db";
import { ColorDots } from "@m2c2kit/assessment-color-dots";
import { ColorShapes } from "@m2c2kit/assessment-color-shapes";
import { GridMemory } from "@m2c2kit/assessment-grid-memory";
import { SymbolSearch } from "@m2c2kit/assessment-symbol-search";
import { Survey } from "@m2c2kit/survey";
import { Game } from "@m2c2kit/core";
import { onNativeEvent, sendToNative } from "./bridge";
import { buildEmaSurveyJson } from "./survey-protocol";
import {
  getAssessmentConfigsForPackage,
  getSurveyConfigForPackage,
} from "./package-protocol";
import {
  extractSurveyItemResponses,
  persistSurveyItemResponses,
} from "./data/survey-response";
import { loadSavedProtocol, mountSetupUI, saveProtocol } from "./setup/setup";
import { createDefaultProtocol } from "./setup/default-protocol";
import type { StudyProtocol } from "../../contracts/study-protocol.schema";

const db = new LocalDatabase();
const survey = new Survey();
const DEFAULT_PROTOCOL = createDefaultProtocol();
let currentProtocol: StudyProtocol = loadSavedProtocol() ?? DEFAULT_PROTOCOL;

const session = new Session({
  activities: [
    new ColorDots(),
    new ColorShapes(),
    new GridMemory(),
    new SymbolSearch(),
    survey,
  ],
  dataStores: [db],
});

Embedding.initialize(session, { host: "MobileWebView" });

session.onActivityData((event) => {
  const surveyResponses = extractSurveyItemResponses(event);
  if (surveyResponses.length > 0) {
    void persistSurveyItemResponses(db, surveyResponses);
  }
});

function setStatus(text: string) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}

function clearAppModeClasses() {
  const app = document.getElementById("app");
  app?.classList.remove("setup-mode");
  app?.classList.remove("standby-mode");
}

function showStandby(protocol: StudyProtocol) {
  const app = document.getElementById("app");
  if (!app) return;
  clearAppModeClasses();
  app.classList.add("standby-mode");
  app.innerHTML = `
    <section class="standby-shell">
      <h2>Protocol Ready</h2>
      <p>The current study protocol is loaded and waiting for enrollment or the next prompt start.</p>
      <p><strong>Study ID:</strong> ${protocol.study_id}</p>
      <p><strong>Protocol Version:</strong> ${protocol.version}</p>
    </section>
  `;
  setStatus(`standby — protocol v${protocol.version}`);
}

function openSetup() {
  const app = document.getElementById("app");
  if (!app) return;
  clearAppModeClasses();
  app.classList.add("setup-mode");
  mountSetupUI(app, currentProtocol, (protocol) => {
    currentProtocol = protocol;
    saveProtocol(protocol);
    showStandby(protocol);
  });
  setStatus(`setup — protocol v${currentProtocol.version}`);
}

// Listen for SESSION_START from native and inject the prompt_id before starting
onNativeEvent((event) => {
  if (event.type === "SESSION_START") {
    const { prompt_id } = event;
    const packageId = event.package_id ?? undefined;
    const protocol = event.protocol ?? currentProtocol;
    currentProtocol = protocol;
    saveProtocol(protocol);
    clearAppModeClasses();

    for (const activity of session.options.activities) {
      if (activity instanceof Survey) {
        activity.setParameters(
          buildEmaSurveyJson(getSurveyConfigForPackage(protocol, packageId), {
            prompt_id,
            study_id: protocol.study_id,
            protocol_version: protocol.version,
          }),
        );
        continue;
      }

      const game = activity as Game;
      const assessmentConfig = getAssessmentConfigsForPackage(
        protocol,
        packageId,
      ).find((candidate) => candidate.activity_id === game.id);
      const mergedParameters = {
        ...(assessmentConfig?.parameters ?? {}),
        prompt_id,
      };

      if (typeof game.setParameters === "function") {
        game.setParameters(mergedParameters);
      } else if (game.options?.parameters) {
        Object.entries(mergedParameters).forEach(([key, value]) => {
          if (game.options?.parameters) {
            game.options.parameters[key] = { default: value };
          }
        });
      }
    }

    // Signal native that session has started
    session.onStart(() => {
      setStatus(`running — prompt ${prompt_id}`);
      sendToNative({
        type: "SESSION_LIFECYCLE",
        event: "started",
        session_uuid: session.uuid,
        prompt_id,
      });
    });

    session.onEnd(() => {
      sendToNative({
        type: "SESSION_LIFECYCLE",
        event: "ended",
        session_uuid: session.uuid,
        prompt_id,
      });
      // Request a sync after session ends
      sendToNative({ type: "SYNC_REQUEST" });
      showStandby(protocol);
    });

    // Listen for cancel on each activity (Session has no onCancel)
    for (const activity of session.options.activities) {
      activity.onCancel(() => {
        sendToNative({
          type: "SESSION_LIFECYCLE",
          event: "canceled",
          session_uuid: session.uuid,
          prompt_id,
        });
      });
    }

    console.log(
      `[EMA] Starting session for prompt ${prompt_id}, package: ${packageId ?? "default"}, protocol: ${protocol?.study_id ?? "unknown"}`,
    );
    session.start();
  }
});

document.getElementById("btn-setup")?.addEventListener("click", openSetup);

session.initialize();

showStandby(currentProtocol);
