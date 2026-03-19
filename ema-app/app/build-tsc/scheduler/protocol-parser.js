import { windowEngine } from "./window-engine";
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
/**
 * Generate the full prompt schedule for a study from its start date.
 * Returns one ScheduledPrompt per EMA prompt slot.
 */
export function generateSchedule(protocol, participantId, startDate) {
  const prompts = [];
  const { schedule } = protocol;
  for (let day = 0; day < schedule.days_total; day++) {
    const date = addDays(startDate, day);
    const slots = schedule.randomize_within_window
      ? windowEngine.randomizeWithinWindows(
          date,
          schedule.windows,
          schedule.prompts_per_day,
          schedule.min_gap_minutes,
        )
      : windowEngine.distributeEvenly(
          date,
          schedule.windows,
          schedule.prompts_per_day,
        );
    slots.forEach((scheduledFor, slotIndex) => {
      prompts.push({
        prompt_id: crypto.randomUUID(),
        study_id: protocol.study_id,
        participant_id: participantId,
        scheduled_for: scheduledFor.toISOString(),
        day_index: day,
        window_index: 0, // simplified: treat all windows as one span
        slot_index: slotIndex,
      });
    });
  }
  return prompts;
}
