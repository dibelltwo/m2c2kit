/**
 * Context snapshot contract — GPS + sensor data at prompt time.
 * Owned by: Protocol Architect (Agent 00)
 * Read by: Native Platform (02), Data & Sync (04), Backend (05)
 */

export interface ContextSnapshot {
  snapshot_id: string;           // UUID
  prompt_id: string;             // FK → PromptLogEntry.prompt_id
  participant_id: string;
  captured_at: string;           // ISO 8601

  // GPS
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_meters: number | null;

  // Device state
  battery_level: number | null;  // 0.0–1.0
  is_charging: boolean | null;
  network_type: "wifi" | "cellular" | "none" | null;
}
