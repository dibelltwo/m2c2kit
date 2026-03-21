import type { ComplianceTracker } from "./compliance-tracker";
import type { ScheduledPrompt } from "../../../contracts/study-protocol.schema";

type ExpiryMinutesResolver = number | ((prompt: ScheduledPrompt) => number);

/**
 * Scans pending prompts and marks any that have passed their expiry window.
 * Called by the background runner (background.js) and on app foreground.
 */
export function checkExpiry(
  prompts: ScheduledPrompt[],
  tracker: ComplianceTracker,
  expiryMinutes: ExpiryMinutesResolver,
): { expired: string[]; missed: string[] } {
  const nowMs = Date.now();
  const expired: string[] = [];
  const missed: string[] = [];

  for (const prompt of prompts) {
    const entry = tracker.get(prompt.prompt_id);
    if (!entry) continue;

    const expiryMs =
      (typeof expiryMinutes === "function"
        ? expiryMinutes(prompt)
        : expiryMinutes) * 60_000;
    const scheduledMs = new Date(prompt.scheduled_for).getTime();

    if (entry.status === "sent" && entry.sent_at) {
      // Prompt was delivered but never opened — check if past expiry
      const sentMs = new Date(entry.sent_at).getTime();
      if (nowMs - sentMs > expiryMs) {
        tracker.markExpired(prompt.prompt_id);
        expired.push(prompt.prompt_id);
      }
    } else if (entry.status === "scheduled" && nowMs > scheduledMs + expiryMs) {
      // Notification was never delivered (edge case — device offline at fire time)
      tracker.markMissed(prompt.prompt_id);
      missed.push(prompt.prompt_id);
    }
  }

  return { expired, missed };
}
