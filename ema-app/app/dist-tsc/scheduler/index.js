/**
 * Scheduler — main entry point.
 *
 * Responsibilities:
 *  1. Parse a StudyProtocol into a full ScheduledPrompt list
 *  2. Register local notifications via Capacitor
 *  3. Handle notification taps → fire SESSION_START bridge event
 *  4. Track compliance status transitions
 *  5. Run expiry checks on app foreground / background runner
 */
import { LocalNotifications } from "@capacitor/local-notifications";
import { generateSchedule } from "./protocol-parser";
import { ComplianceTracker } from "./compliance-tracker";
import { checkExpiry } from "./expiry-checker";
import { dispatchLocalNativeEvent } from "../bridge";
export { ComplianceTracker } from "./compliance-tracker";
export { generateSchedule } from "./protocol-parser";
/** Stable integer ID for a prompt_id UUID (LocalNotifications requires int). */
function promptIdToInt(promptId) {
  let hash = 0;
  for (let i = 0; i < promptId.length; i++) {
    hash = (Math.imul(31, hash) + promptId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
export class Scheduler {
  constructor(protocol, participantId) {
    this.protocol = protocol;
    this.participantId = participantId;
    this.prompts = [];
    this.tracker = new ComplianceTracker();
  }
  /** Generate schedule and register all local notifications. */
  async start(startDate = new Date()) {
    this.prompts = generateSchedule(
      this.protocol,
      this.participantId,
      startDate,
    );
    // Persist to tracker
    for (const p of this.prompts) {
      this.tracker.createPrompt({
        prompt_id: p.prompt_id,
        study_id: p.study_id,
        participant_id: p.participant_id,
        session_uuid: null,
        scheduled_for: p.scheduled_for,
        sent_at: null,
        opened_at: null,
        assessment_started_at: null,
        assessment_ended_at: null,
        status: "scheduled",
        quit_early: false,
        n_trials_completed: null,
        context_snapshot_id: null,
      });
    }
    await this.scheduleNotifications();
    this.listenForTaps();
  }
  /** Run expiry check — call on app foreground and from background runner. */
  runExpiryCheck() {
    return checkExpiry(
      this.prompts,
      this.tracker,
      this.protocol.schedule.expiry_minutes,
    );
  }
  getSchedule() {
    return [...this.prompts];
  }
  async scheduleNotifications() {
    const now = Date.now();
    const future = this.prompts.filter(
      (p) => new Date(p.scheduled_for).getTime() > now,
    );
    await LocalNotifications.schedule({
      notifications: future.map((p) => ({
        id: promptIdToInt(p.prompt_id),
        title: "Time for your check-in",
        body: "Tap to complete a brief assessment.",
        schedule: { at: new Date(p.scheduled_for) },
        extra: { prompt_id: p.prompt_id },
      })),
    });
    console.log(`[Scheduler] Scheduled ${future.length} notifications`);
  }
  listenForTaps() {
    LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        const promptId = action.notification.extra?.prompt_id;
        if (!promptId) return;
        const entry = this.tracker.get(promptId);
        if (!entry) return;
        // Check if still within expiry window
        const sentAt = entry.sent_at
          ? new Date(entry.sent_at).getTime()
          : Date.now();
        const expiryMs = this.protocol.schedule.expiry_minutes * 60000;
        if (Date.now() - sentAt > expiryMs) {
          this.tracker.markExpired(promptId);
          return;
        }
        this.tracker.markOpened(promptId);
        dispatchLocalNativeEvent({
          type: "SESSION_START",
          prompt_id: promptId,
          protocol: this.protocol,
        });
      },
    );
  }
}
