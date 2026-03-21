/**
 * Survey item response contract.
 * One row per survey item per completed prompt session.
 */

export interface SurveyItemResponse {
  record_id: string;
  session_uuid: string;
  prompt_id: string | null;
  study_id: string | null;
  protocol_version: number | null;
  survey_id: string;
  survey_version: number | null;
  item_id: string;
  response_status: "answered" | "skipped";
  response_value: string | number | boolean | string[] | number[] | null;
  captured_at: string;
}
