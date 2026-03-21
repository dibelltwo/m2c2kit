import type {
  ScheduleRule,
  StudyProtocol,
  ScheduledPrompt,
  TimeBlock,
} from "../../../contracts/study-protocol.schema";
import { windowEngine } from "./window-engine";

interface PromptTimingOptions {
  windows: TimeBlock[];
  promptsPerDay: number;
  minGapMinutes: number;
  randomize: boolean;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getEffectiveStartDate(
  protocol: StudyProtocol,
  fallbackStartDate: Date,
): Date {
  return protocol.schedule.start_date
    ? new Date(`${protocol.schedule.start_date}T00:00:00`)
    : fallbackStartDate;
}

function createDailyPromptTimes(
  date: Date,
  options: PromptTimingOptions,
): Date[] {
  return options.randomize
    ? windowEngine.randomizeWithinWindows(
        date,
        options.windows,
        options.promptsPerDay,
        options.minGapMinutes,
      )
    : windowEngine.distributeEvenly(
        date,
        options.windows,
        options.promptsPerDay,
      );
}

function addRulePrompts(
  prompts: ScheduledPrompt[],
  protocol: StudyProtocol,
  participantId: string,
  startDate: Date,
  dayCount: number,
  rule: ScheduleRule,
) {
  const randomize = rule.schedule_mode === "random_block";

  for (let day = 0; day < dayCount; day++) {
    const date = addDays(startDate, day);
    const slots = createDailyPromptTimes(date, {
      windows: rule.time_blocks,
      promptsPerDay: rule.prompts_per_day,
      minGapMinutes: rule.min_gap_minutes,
      randomize,
    });

    slots.forEach((scheduledFor, slotIndex) => {
      prompts.push({
        prompt_id: crypto.randomUUID(),
        study_id: protocol.study_id,
        participant_id: participantId,
        package_id: rule.package_id,
        rule_id: rule.rule_id,
        scheduled_for: scheduledFor.toISOString(),
        day_index: day,
        window_index: 0,
        slot_index: slotIndex,
      });
    });
  }
}

/**
 * Generate the full prompt schedule for a study from its start date.
 * Returns one ScheduledPrompt per EMA prompt slot.
 */
export function generateSchedule(
  protocol: StudyProtocol,
  participantId: string,
  startDate: Date,
): ScheduledPrompt[] {
  const prompts: ScheduledPrompt[] = [];
  const { schedule } = protocol;
  const effectiveStartDate = getEffectiveStartDate(protocol, startDate);

  if (protocol.schedule_rules && protocol.schedule_rules.length > 0) {
    for (const rule of protocol.schedule_rules) {
      addRulePrompts(
        prompts,
        protocol,
        participantId,
        effectiveStartDate,
        schedule.days_total,
        rule,
      );
    }

    prompts.sort(
      (left, right) =>
        new Date(left.scheduled_for).getTime() -
        new Date(right.scheduled_for).getTime(),
    );
    return prompts;
  }

  const windows = schedule.time_blocks ?? schedule.windows ?? [];
  const shouldRandomize =
    schedule.schedule_mode === "random_block" ||
    (schedule.schedule_mode === undefined &&
      schedule.randomize_within_window !== false);

  for (let day = 0; day < schedule.days_total; day++) {
    const date = addDays(effectiveStartDate, day);
    const slots = createDailyPromptTimes(date, {
      windows,
      promptsPerDay: schedule.prompts_per_day,
      minGapMinutes: schedule.min_gap_minutes,
      randomize: shouldRandomize,
    });

    slots.forEach((scheduledFor, slotIndex) => {
      prompts.push({
        prompt_id: crypto.randomUUID(),
        study_id: protocol.study_id,
        participant_id: participantId,
        package_id: protocol.default_package_id ?? null,
        rule_id: null,
        scheduled_for: scheduledFor.toISOString(),
        day_index: day,
        window_index: 0, // simplified: treat all windows as one span
        slot_index: slotIndex,
      });
    });
  }

  return prompts;
}
