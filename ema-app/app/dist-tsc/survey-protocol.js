const DEFAULT_UNANSWERED_WARNING =
  "Please answer or skip all questions before submitting the survey.";
const DEFAULT_INLINE_WARNING = "Answer this question or choose Skip.";
const DEFAULT_ANSWER_LABEL = "Answer question";
const DEFAULT_SKIP_LABEL = "Skip question";
function makeDispositionName(itemId) {
  return `${itemId}__disposition`;
}
function makePageForItem(item, surveyConfig, index) {
  const dispositionName = makeDispositionName(item.item_id);
  const skipLabel = item.skip_label ?? surveyConfig.skip_choice_label;
  const itemElement = makeItemElement(item, dispositionName);
  return {
    name: `item-${index + 1}-${item.item_id}`,
    elements: [
      {
        type: "radiogroup",
        name: dispositionName,
        titleLocation: "hidden",
        defaultValue: "answered",
        startWithNewLine: false,
        cssClasses: {
          root: "ema-skip-control",
        },
        choices: [
          {
            value: "answered",
            text: surveyConfig.answer_choice_label ?? DEFAULT_ANSWER_LABEL,
          },
          {
            value: "skipped",
            text: skipLabel ?? DEFAULT_SKIP_LABEL,
          },
        ],
      },
      {
        type: "expression",
        name: `__prompt_${item.item_id}`,
        title: item.prompt,
      },
      ...(item.help_text
        ? [
            {
              type: "expression",
              name: `__help_${item.item_id}`,
              title: item.help_text,
            },
          ]
        : []),
      itemElement,
    ],
  };
}
function makeItemElement(item, dispositionName) {
  switch (item.kind) {
    case "slider":
      return makeSliderElement(item, dispositionName);
    case "single_choice":
      return makeSingleChoiceElement(item, dispositionName);
    case "multi_choice":
      return makeMultiChoiceElement(item, dispositionName);
    case "text":
      return makeTextElement(item, dispositionName);
  }
}
function makeSliderElement(item, dispositionName) {
  return {
    type: "nouislider-m2c2",
    name: item.item_id,
    title: "Response",
    visibleIf: `{${dispositionName}} != 'skipped'`,
    isRequired: true,
    requiredIf: `{${dispositionName}} != 'skipped'`,
    requiredErrorText: DEFAULT_INLINE_WARNING,
    rangeMin: item.min,
    rangeMax: item.max,
    step: item.step ?? 1,
    tooltips: true,
    pipsDensity: -1,
    showOnlyPipsWithPipsText: true,
    pipsText: [
      { value: item.min, text: item.min_label ?? String(item.min) },
      { value: item.max, text: item.max_label ?? String(item.max) },
    ],
  };
}
function makeSingleChoiceElement(item, dispositionName) {
  return {
    type: "radiogroup",
    name: item.item_id,
    title: "Response",
    visibleIf: `{${dispositionName}} != 'skipped'`,
    isRequired: true,
    requiredIf: `{${dispositionName}} != 'skipped'`,
    requiredErrorText: DEFAULT_INLINE_WARNING,
    choices: item.choices.map((choice) => ({
      value: choice.value,
      text: choice.label,
    })),
  };
}
function makeMultiChoiceElement(item, dispositionName) {
  return {
    type: "checkbox",
    name: item.item_id,
    title: "Response",
    visibleIf: `{${dispositionName}} != 'skipped'`,
    isRequired: true,
    requiredIf: `{${dispositionName}} != 'skipped'`,
    requiredErrorText: DEFAULT_INLINE_WARNING,
    choices: item.choices.map((choice) => ({
      value: choice.value,
      text: choice.label,
    })),
  };
}
function makeTextElement(item, dispositionName) {
  return {
    type: "text",
    name: item.item_id,
    title: "Response",
    visibleIf: `{${dispositionName}} != 'skipped'`,
    isRequired: true,
    requiredIf: `{${dispositionName}} != 'skipped'`,
    requiredErrorText: DEFAULT_INLINE_WARNING,
    placeholder: item.placeholder,
  };
}
export function buildEmaSurveyJson(surveyConfig, options = {}) {
  return {
    id: surveyConfig.survey_id,
    name: surveyConfig.survey_id,
    title: surveyConfig.title,
    showQuestionNumbers: "off",
    completeText: surveyConfig.submit_button_text ?? "Submit survey",
    completedHtml: "<html></html>",
    checkErrorsMode: "onValueChanged",
    firstPageIsStarted: Boolean(surveyConfig.instruction),
    startSurveyText: "Begin",
    pages: [
      ...(surveyConfig.instruction
        ? [
            {
              name: "intro",
              elements: [
                {
                  type: "expression",
                  name: "__intro",
                  title: surveyConfig.instruction,
                },
              ],
            },
          ]
        : []),
      ...surveyConfig.items.map((item, index) =>
        makePageForItem(item, surveyConfig, index),
      ),
    ],
    completedBeforeHtml:
      surveyConfig.unanswered_warning_text ?? DEFAULT_UNANSWERED_WARNING,
    showCompletedPage: false,
    confirmSkipping: false,
    survey_version: surveyConfig.survey_version,
    prompt_id: options.prompt_id ?? "",
    study_id: options.study_id ?? null,
    protocol_version: options.protocol_version ?? null,
  };
}
