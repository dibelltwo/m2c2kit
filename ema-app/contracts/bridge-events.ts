/**
 * Bridge event types for JS ↔ Native communication.
 * Owned by: Protocol Architect (Agent 00)
 * Read by: Native Platform (02), Scheduler (03), Setup UI (06)
 *
 * DO NOT modify without coordinating all dependent agents.
 */

import type { StudyProtocol } from "./study-protocol.schema";
import type { ContextSnapshot } from "./context-snapshot.schema";

// ---------------------------------------------------------------------------
// Native → JS (native shell sends these to the WebView)
// ---------------------------------------------------------------------------

export type NativeToJSEvent =
  /** Native fires this when user taps a notification. Starts the m2c2kit session. */
  | { type: "SESSION_START"; prompt_id: string; protocol: StudyProtocol }
  /** GPS + sensor data captured at prompt fire time, passed to WebView for storage. */
  | { type: "CONTEXT_SNAPSHOT"; snapshot: ContextSnapshot }
  /** Native informs JS that a prompt was sent (notification delivered). */
  | { type: "PROMPT_SENT"; prompt_id: string; sent_at: string }
  /** Native informs JS that a prompt was not responded to (past expiry). */
  | { type: "PROMPT_EXPIRED"; prompt_id: string }
  /** Native signals app is being backgrounded (save state). */
  | { type: "APP_BACKGROUND" }
  /** Native signals app has returned to foreground. */
  | { type: "APP_FOREGROUND" };

// ---------------------------------------------------------------------------
// JS → Native (WebView sends these to the native shell)
// ---------------------------------------------------------------------------

export type JSToNativeEvent =
  /** Study protocol set by Setup UI — triggers notification scheduling. */
  | { type: "PROTOCOL_SET"; protocol: StudyProtocol }
  /** m2c2kit session lifecycle update. */
  | {
      type: "SESSION_LIFECYCLE";
      event: "started" | "ended" | "canceled";
      session_uuid: string;
      prompt_id: string;
    }
  /** Compliance status update from Scheduler agent. */
  | {
      type: "COMPLIANCE_UPDATE";
      prompt_id: string;
      status: PromptStatus;
      n_trials_completed?: number;
      quit_early?: boolean;
    }
  /** Request native to trigger a sync (opportunistic, after session end). */
  | { type: "SYNC_REQUEST" };

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PromptStatus =
  | "scheduled"
  | "sent"
  | "opened"
  | "started"
  | "completed"
  | "quit_early"
  | "missed"
  | "expired";
