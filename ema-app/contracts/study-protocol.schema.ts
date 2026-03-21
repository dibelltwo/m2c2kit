/**
 * Study protocol contract.
 * Owned by: Protocol Architect (Agent 00)
 * Read by: all agents.
 *
 * DO NOT modify without coordinating all dependent agents.
 */

export interface StudyProtocol {
  study_id: string;
  study_uuid: string; // UUID, generated at creation
  version: number; // increment on any change

  schedule: ScheduleConfig;
  question_bank?: QuestionBankItem[];
  packages?: StudyPackage[];
  schedule_rules?: ScheduleRule[];
  default_package_id?: string;

  /** Back-compat fields during migration to package-based structure. */
  assessments: AssessmentConfig[];
  ema_survey: EmaSurveyConfig;
  context_collection: ContextCollectionConfig;
}

export type QuestionBankItem = EmaSurveyItem & {
  status: "active" | "hidden";
};

export interface PackageAssessment {
  activity_id: string;
  activity_version: string;
  parameters: Record<string, unknown>;
  order?: number;
}

export interface PackageSurveyItemRef {
  item_id: string;
}

export interface StudyPackage {
  package_id: string;
  package_name: string;
  package_version: number;
  assessments: PackageAssessment[];
  survey_item_refs: PackageSurveyItemRef[];
}

export interface ScheduleRule {
  rule_id: string;
  package_id: string;
  schedule_mode: ScheduleMode;
  time_blocks: TimeBlock[];
  prompts_per_day: number;
  min_gap_minutes: number;
  expiry_minutes: number;
}

export type ScheduleMode = "random_block" | "fixed_time" | "event_contingent";

export interface TimeBlock {
  start: string; // "HH:MM" format
  end: string; // "HH:MM" format
}

export interface ScheduleConfig {
  /**
   * Default study delivery mode.
   * random_block = pick random prompt times within researcher-defined blocks.
   * fixed_time = evenly distribute prompts across the allowed blocks.
   * event_contingent = reserved for future GPS/context-triggered prompting.
   */
  schedule_mode: ScheduleMode;

  /** Researcher-defined delivery blocks for random_block / fixed_time modes. */
  time_blocks: TimeBlock[];

  /**
   * Back-compat alias for older code paths. When present, it should mirror
   * time_blocks.
   */
  windows?: TimeBlock[];

  /** Number of prompts per day. Must fit within windows with min_gap_minutes spacing. */
  prompts_per_day: number;

  /**
   * Back-compat flag for older code paths.
   * random_block maps to true, fixed_time maps to false.
   */
  randomize_within_window?: boolean;

  /**
   * Minutes after prompt delivery before it is marked expired.
   * Also controls how long the app shows the assessment after notification tap.
   */
  expiry_minutes: number;

  /** Optional protocol start date in YYYY-MM-DD format. */
  start_date?: string;

  /** Optional protocol end date in YYYY-MM-DD format. */
  end_date?: string;

  /** Total study duration in days. */
  days_total: number;

  /** Minimum gap between consecutive prompts in minutes. Default 30. */
  min_gap_minutes: number;
}

export interface AssessmentConfig {
  /** Must match activity_id in the m2c2kit assessment package. */
  activity_id: string;

  /** Version of the assessment package used at protocol creation time. */
  activity_version: string;

  /**
   * Parameter overrides — merged with assessment defaults.
   * Keys must match parameter names in the assessment's schemas.json.
   */
  parameters: Record<string, unknown>;

  /**
   * How to select assessments when multiple configs are present.
   * "all" = run every assessment each prompt (default)
   * "random_one" = pick one at random per prompt
   * "round_robin" = cycle through assessments across prompts
   */
  selection_strategy?: "all" | "random_one" | "round_robin";

  /** Run order when selection_strategy is "all". Lower numbers run first. */
  order?: number;
}

export interface EmaSurveyConfig {
  survey_id: string;
  survey_version: number;
  title: string;
  instruction?: string;
  submit_button_text?: string;
  unanswered_warning_text?: string;
  answer_choice_label?: string;
  skip_choice_label?: string;
  items: EmaSurveyItem[];
}

interface EmaSurveyItemBase {
  item_id: string;
  prompt: string;
  help_text?: string;
  skip_label?: string;
}

export interface SliderSurveyItem extends EmaSurveyItemBase {
  kind: "slider";
  min: number;
  max: number;
  step?: number;
  min_label?: string;
  max_label?: string;
}

export interface SingleChoiceSurveyItem extends EmaSurveyItemBase {
  kind: "single_choice";
  choices: Array<{
    value: string | number;
    label: string;
  }>;
}

export interface MultiChoiceSurveyItem extends EmaSurveyItemBase {
  kind: "multi_choice";
  choices: Array<{
    value: string | number;
    label: string;
  }>;
}

export interface TextSurveyItem extends EmaSurveyItemBase {
  kind: "text";
  placeholder?: string;
}

export type EmaSurveyItem =
  | SliderSurveyItem
  | SingleChoiceSurveyItem
  | MultiChoiceSurveyItem
  | TextSurveyItem;

export interface ContextCollectionConfig {
  /** Collect GPS location when a prompt fires. */
  gps_on_prompt: boolean;

  /**
   * If set, also collect GPS every N minutes in the background (passive tracking).
   * Null means prompt-only.
   */
  gps_interval_minutes: number | null;

  /** Collect battery level and charging state. */
  collect_battery: boolean;

  /** Collect network connection type (wifi / cellular / none). */
  collect_network_type: boolean;
}

/** A single computed prompt slot derived from StudyProtocol. */
export interface ScheduledPrompt {
  prompt_id: string; // UUID, generated by scheduler
  study_id: string;
  participant_id: string;
  package_id: string | null;
  rule_id: string | null;
  scheduled_for: string; // ISO 8601 (local time, UTC offset included)
  day_index: number; // 0-based day within study
  window_index: number; // which window within the day
  slot_index: number; // which slot within the window
}
