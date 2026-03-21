function asSurveyVariables(variables) {
    if (!Array.isArray(variables))
        return null;
    return variables;
}
function normalizeResponseValue(value) {
    if (value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value) &&
        value.every((entry) => typeof entry === "string" || typeof entry === "number")) {
        return value;
    }
    return null;
}
export function extractSurveyItemResponses(event) {
    if (event.target.type !== "Survey") {
        return [];
    }
    const variables = asSurveyVariables(event.newData.variables);
    if (!variables) {
        return [];
    }
    const variableMap = new Map(variables.map((variable) => [variable.name, variable.value]));
    const surveyId = typeof event.target.id === "string" ? event.target.id : "survey";
    const surveyVersion = typeof event.target.additionalParameters === "object" &&
        event.target.additionalParameters !== null &&
        "survey_version" in event.target.additionalParameters &&
        typeof event.target.additionalParameters
            .survey_version === "number"
        ? event.target.additionalParameters
            .survey_version
        : null;
    const protocolVersion = typeof event.target.additionalParameters === "object" &&
        event.target.additionalParameters !== null &&
        "protocol_version" in event.target.additionalParameters &&
        typeof event.target.additionalParameters
            .protocol_version === "number"
        ? event.target.additionalParameters
            .protocol_version
        : null;
    const promptId = typeof event.target.additionalParameters === "object" &&
        event.target.additionalParameters !== null &&
        "prompt_id" in event.target.additionalParameters &&
        typeof event.target.additionalParameters
            .prompt_id === "string"
        ? event.target.additionalParameters
            .prompt_id || null
        : null;
    return variables
        .filter((variable) => variable.name.endsWith("__disposition"))
        .map((dispositionVariable) => {
        const itemId = dispositionVariable.name.replace(/__disposition$/, "");
        const hasResponse = variableMap.has(itemId);
        const responseStatus = dispositionVariable.value === "skipped" && !hasResponse
            ? "skipped"
            : "answered";
        const responseValue = responseStatus === "answered"
            ? normalizeResponseValue(variableMap.get(itemId))
            : null;
        return {
            record_id: `${event.newData.document_uuid}:${itemId}`,
            session_uuid: typeof event.newData.session_uuid === "string"
                ? event.newData.session_uuid
                : event.target.sessionUuid,
            prompt_id: promptId,
            study_id: typeof event.newData.study_id === "string"
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
export async function persistSurveyItemResponses(db, responses) {
    await Promise.all(responses.map((response) => db.setItem(`ema-survey-response:${response.record_id}`, response, "ema-app-survey-responses")));
}
