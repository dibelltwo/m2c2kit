import type { SurveyVariable } from "@m2c2kit/survey";
import type { ActivityResultsEvent } from "@m2c2kit/core";
import type { LocalDatabase } from "@m2c2kit/db";
import type { SurveyItemResponse as SurveyItemResponseRecord } from "../../../contracts/survey-response.schema";

function asSurveyVariables(variables: unknown): SurveyVariable[] | null {
  if (!Array.isArray(variables)) return null;
  return variables as SurveyVariable[];
}

function normalizeResponseValue(
  value: unknown,
): SurveyItemResponseRecord["response_value"] {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (
    Array.isArray(value) &&
    value.every(
      (entry) => typeof entry === "string" || typeof entry === "number",
    )
  ) {
    return value as string[] | number[];
  }
  return null;
}

export function extractSurveyItemResponses(
  event: ActivityResultsEvent,
): SurveyItemResponseRecord[] {
  if (event.target.type !== "Survey") {
    return [];
  }

  const variables = asSurveyVariables(event.newData.variables);
  if (!variables) {
    return [];
  }

  const variableMap = new Map(
    variables.map((variable) => [variable.name, variable.value]),
  );
  const surveyId =
    typeof event.target.id === "string" ? event.target.id : "survey";
  const surveyVersion =
    typeof event.target.additionalParameters === "object" &&
    event.target.additionalParameters !== null &&
    "survey_version" in event.target.additionalParameters &&
    typeof (event.target.additionalParameters as { survey_version?: unknown })
      .survey_version === "number"
      ? (event.target.additionalParameters as { survey_version: number })
          .survey_version
      : null;

  const protocolVersion =
    typeof event.target.additionalParameters === "object" &&
    event.target.additionalParameters !== null &&
    "protocol_version" in event.target.additionalParameters &&
    typeof (event.target.additionalParameters as { protocol_version?: unknown })
      .protocol_version === "number"
      ? (event.target.additionalParameters as { protocol_version: number })
          .protocol_version
      : null;

  const promptId =
    typeof event.target.additionalParameters === "object" &&
    event.target.additionalParameters !== null &&
    "prompt_id" in event.target.additionalParameters &&
    typeof (event.target.additionalParameters as { prompt_id?: unknown })
      .prompt_id === "string"
      ? (event.target.additionalParameters as { prompt_id: string })
          .prompt_id || null
      : null;

  return variables
    .filter((variable) => variable.name.endsWith("__disposition"))
    .map((dispositionVariable) => {
      const itemId = dispositionVariable.name.replace(/__disposition$/, "");
      const hasResponse = variableMap.has(itemId);
      const responseStatus =
        dispositionVariable.value === "skipped" && !hasResponse
          ? "skipped"
          : "answered";
      const responseValue =
        responseStatus === "answered"
          ? normalizeResponseValue(variableMap.get(itemId))
          : null;

      return {
        record_id: `${event.newData.document_uuid}:${itemId}`,
        session_uuid:
          typeof event.newData.session_uuid === "string"
            ? event.newData.session_uuid
            : event.target.sessionUuid,
        prompt_id: promptId,
        study_id:
          typeof event.newData.study_id === "string"
            ? event.newData.study_id
            : null,
        protocol_version: protocolVersion,
        survey_id: surveyId,
        survey_version: surveyVersion,
        item_id: itemId,
        response_status: responseStatus,
        response_value: responseValue,
        captured_at: event.iso8601Timestamp,
      };
    });
}

export async function persistSurveyItemResponses(
  db: LocalDatabase,
  responses: SurveyItemResponseRecord[],
): Promise<void> {
  await Promise.all(
    responses.map((response) =>
      db.setItem(
        `ema-survey-response:${response.record_id}`,
        response,
        "ema-app-survey-responses",
      ),
    ),
  );
}
