export function createDefaultProtocol() {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 13);
  const startDateString = startDate.toISOString().slice(0, 10);
  const endDateString = endDate.toISOString().slice(0, 10);
  return {
    study_id: "dev-study",
    study_uuid: crypto.randomUUID(),
    version: 1,
    schedule: {
      schedule_mode: "random_block",
      time_blocks: [{ start: "09:00", end: "21:00" }],
      windows: [{ start: "09:00", end: "21:00" }],
      prompts_per_day: 5,
      randomize_within_window: true,
      expiry_minutes: 30,
      start_date: startDateString,
      end_date: endDateString,
      days_total: 14,
      min_gap_minutes: 30,
    },
    assessments: [
      {
        activity_id: "color-dots",
        activity_version: "latest",
        parameters: { number_of_trials: 3, scoring: true },
        selection_strategy: "round_robin",
        order: 0,
      },
      {
        activity_id: "color-shapes",
        activity_version: "latest",
        parameters: {
          number_of_trials: 3,
          number_of_different_colors_trials: 2,
          scoring: true,
        },
        selection_strategy: "round_robin",
        order: 1,
      },
      {
        activity_id: "grid-memory",
        activity_version: "latest",
        parameters: { number_of_trials: 3, scoring: true },
        selection_strategy: "round_robin",
        order: 2,
      },
      {
        activity_id: "symbol-search",
        activity_version: "latest",
        parameters: { number_of_trials: 3, scoring: true },
        selection_strategy: "round_robin",
        order: 3,
      },
    ],
    ema_survey: {
      survey_id: "ema-mood-stress",
      survey_version: 1,
      title: "EMA Check-in",
      instruction:
        "Please answer or skip each question before submitting the survey.",
      unanswered_warning_text:
        "Please answer or skip all questions before submitting the survey.",
      answer_choice_label: "Answer question",
      skip_choice_label: "Skip question",
      items: [
        {
          item_id: "mood",
          kind: "slider",
          prompt: "How is your overall mood right now?",
          min: 0,
          max: 100,
          min_label: "Very bad",
          max_label: "Very good",
        },
        {
          item_id: "stress",
          kind: "slider",
          prompt: "How stressed do you feel right now?",
          min: 0,
          max: 100,
          min_label: "Not at all",
          max_label: "Extremely",
        },
        {
          item_id: "energy",
          kind: "slider",
          prompt: "How much energy do you have right now?",
          min: 0,
          max: 100,
          min_label: "Very tired",
          max_label: "Very energetic",
        },
      ],
    },
    question_bank: [
      {
        item_id: "mood",
        kind: "slider",
        prompt: "How is your overall mood right now?",
        min: 0,
        max: 100,
        min_label: "Very bad",
        max_label: "Very good",
        status: "active",
      },
      {
        item_id: "stress",
        kind: "slider",
        prompt: "How stressed do you feel right now?",
        min: 0,
        max: 100,
        min_label: "Not at all",
        max_label: "Extremely",
        status: "active",
      },
      {
        item_id: "energy",
        kind: "slider",
        prompt: "How much energy do you have right now?",
        min: 0,
        max: 100,
        min_label: "Very tired",
        max_label: "Very energetic",
        status: "active",
      },
    ],
    packages: [
      {
        package_id: "morning-survey",
        package_name: "Morning Survey",
        package_version: 1,
        assessments: [],
        survey_item_refs: [{ item_id: "mood" }, { item_id: "energy" }],
      },
      {
        package_id: "random-cognition-a",
        package_name: "Random Cognition A",
        package_version: 1,
        assessments: [
          {
            activity_id: "symbol-search",
            activity_version: "latest",
            parameters: { number_of_trials: 3, scoring: true },
            order: 0,
          },
          {
            activity_id: "color-dots",
            activity_version: "latest",
            parameters: { number_of_trials: 3, scoring: true },
            order: 1,
          },
        ],
        survey_item_refs: [],
      },
      {
        package_id: "evening-mixed",
        package_name: "Evening Mixed",
        package_version: 1,
        assessments: [
          {
            activity_id: "grid-memory",
            activity_version: "latest",
            parameters: { number_of_trials: 3, scoring: true },
            order: 0,
          },
          {
            activity_id: "color-shapes",
            activity_version: "latest",
            parameters: {
              number_of_trials: 3,
              number_of_different_colors_trials: 2,
              scoring: true,
            },
            order: 1,
          },
        ],
        survey_item_refs: [{ item_id: "mood" }, { item_id: "stress" }],
      },
    ],
    schedule_rules: [
      {
        rule_id: "rule-morning",
        package_id: "morning-survey",
        schedule_mode: "fixed_time",
        time_blocks: [{ start: "08:00", end: "10:00" }],
        prompts_per_day: 1,
        min_gap_minutes: 60,
        expiry_minutes: 30,
      },
      {
        rule_id: "rule-daytime",
        package_id: "random-cognition-a",
        schedule_mode: "random_block",
        time_blocks: [
          { start: "12:00", end: "15:00" },
          { start: "16:00", end: "18:00" },
        ],
        prompts_per_day: 2,
        min_gap_minutes: 60,
        expiry_minutes: 30,
      },
      {
        rule_id: "rule-evening",
        package_id: "evening-mixed",
        schedule_mode: "fixed_time",
        time_blocks: [{ start: "18:00", end: "21:00" }],
        prompts_per_day: 1,
        min_gap_minutes: 60,
        expiry_minutes: 30,
      },
    ],
    default_package_id: "evening-mixed",
    context_collection: {
      gps_on_prompt: false,
      gps_interval_minutes: null,
      collect_battery: false,
      collect_network_type: true,
    },
  };
}
