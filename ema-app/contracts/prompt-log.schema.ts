/**
 * Prompt log contract — compliance tracking record per EMA prompt.
 * Owned by: Protocol Architect (Agent 00)
 * Read by: Scheduler (03), Data & Sync (04), Backend (05)
 */

import type { PromptStatus } from "./bridge-events";

export interface PromptLogEntry {
  prompt_id: string;             // UUID
  study_id: string;
  participant_id: string;

  /** m2c2kit session_uuid — populated when assessment starts. */
  session_uuid: string | null;

  scheduled_for: string;         // ISO 8601
  sent_at: string | null;
  opened_at: string | null;
  assessment_started_at: string | null;
  assessment_ended_at: string | null;

  status: PromptStatus;
  quit_early: boolean;
  n_trials_completed: number | null;

  /** FK → ContextSnapshot.snapshot_id. Null if GPS not collected. */
  context_snapshot_id: string | null;
}

export type { PromptStatus };
