import { Session } from "@m2c2kit/session";
import { Embedding } from "@m2c2kit/embedding";
import { LocalDatabase } from "@m2c2kit/db";
import { ColorDots } from "@m2c2kit/assessment-color-dots";
import { ColorShapes } from "@m2c2kit/assessment-color-shapes";
import { GridMemory } from "@m2c2kit/assessment-grid-memory";
import { SymbolSearch } from "@m2c2kit/assessment-symbol-search";
import { onNativeEvent, sendToNative } from "./bridge";
const db = new LocalDatabase();
const session = new Session({
  activities: [
    new ColorDots(),
    new ColorShapes(),
    new GridMemory(),
    new SymbolSearch(),
  ],
  dataStores: [db],
});
Embedding.initialize(session, { host: "MobileWebView" });
// Listen for SESSION_START from native and inject the prompt_id before starting
onNativeEvent((event) => {
  if (event.type === "SESSION_START") {
    const { prompt_id, protocol } = event;
    // Inject prompt_id into each assessment's parameters
    for (const activity of session.options.activities) {
      if (activity.options?.parameters) {
        activity.options.parameters.prompt_id = { default: prompt_id };
      }
    }
    // Signal native that session has started
    session.onStart(() => {
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
    });
    session.onCancel(() => {
      sendToNative({
        type: "SESSION_LIFECYCLE",
        event: "canceled",
        session_uuid: session.uuid,
        prompt_id,
      });
    });
    console.log(
      `[EMA] Starting session for prompt ${prompt_id}, protocol: ${protocol?.study_id ?? "unknown"}`,
    );
    session.start();
  }
});
session.initialize();
