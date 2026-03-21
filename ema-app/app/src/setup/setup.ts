import type {
  AssessmentConfig,
  PackageAssessment,
  QuestionBankItem,
  ScheduleRule,
  SliderSurveyItem,
  StudyPackage,
  StudyProtocol,
  TextSurveyItem,
  TimeBlock,
} from "../../../contracts/study-protocol.schema";

type EditableQuestionBankItem = (SliderSurveyItem | TextSurveyItem) & {
  localId: string;
  status: "active" | "hidden";
};

type EditableTimeBlock = TimeBlock & {
  localId: string;
};

type EditablePackage = {
  localId: string;
  package_id: string;
  package_name: string;
  package_version: number;
  assessments: PackageAssessment[];
  survey_item_refs: string[];
};

type EditableScheduleRule = Omit<ScheduleRule, "time_blocks"> & {
  localId: string;
  time_blocks: EditableTimeBlock[];
};

type SurveyChromeState = {
  survey_id: string;
  title: string;
  instruction?: string;
  submit_button_text?: string;
  unanswered_warning_text?: string;
  answer_choice_label?: string;
  skip_choice_label?: string;
};

type SetupState = {
  study_id: string;
  study_uuid: string;
  version: number;
  default_package_id?: string;
  start_date?: string;
  end_date?: string;
  days_total: number;
  questionBank: EditableQuestionBankItem[];
  packages: EditablePackage[];
  scheduleRules: EditableScheduleRule[];
  surveyChrome: SurveyChromeState;
  context_collection: StudyProtocol["context_collection"];
};

type AssessmentDefinition = {
  activity_id: PackageAssessment["activity_id"];
  label: string;
  defaultParameters: Record<string, unknown>;
};

const ASSESSMENT_LIBRARY: AssessmentDefinition[] = [
  {
    activity_id: "color-dots",
    label: "Color Dots",
    defaultParameters: { number_of_trials: 3, scoring: true },
  },
  {
    activity_id: "color-shapes",
    label: "Color Shapes",
    defaultParameters: {
      number_of_trials: 3,
      number_of_different_colors_trials: 2,
      scoring: true,
    },
  },
  {
    activity_id: "grid-memory",
    label: "Grid Memory",
    defaultParameters: { number_of_trials: 3, scoring: true },
  },
  {
    activity_id: "symbol-search",
    label: "Symbol Search",
    defaultParameters: { number_of_trials: 3, scoring: true },
  },
];

export const DEV_PROTOCOL_STORAGE_KEY = "ema-dev-protocol";

function cloneProtocol(protocol: StudyProtocol): StudyProtocol {
  return JSON.parse(JSON.stringify(protocol)) as StudyProtocol;
}

function makeLocalId(): string {
  return crypto.randomUUID();
}

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function calculateInclusiveDayCount(
  startDate: string,
  endDate: string,
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}

function asEditableQuestion(item: QuestionBankItem): EditableQuestionBankItem {
  return {
    ...item,
    localId: makeLocalId(),
  } as EditableQuestionBankItem;
}

function normalizeQuestionBank(
  protocol: StudyProtocol,
): EditableQuestionBankItem[] {
  if (protocol.question_bank && protocol.question_bank.length > 0) {
    return protocol.question_bank.map(asEditableQuestion);
  }

  return protocol.ema_survey.items.map((item) => ({
    ...item,
    localId: makeLocalId(),
    status: "active",
  })) as EditableQuestionBankItem[];
}

function toPackageAssessment(assessment: AssessmentConfig): PackageAssessment {
  return {
    activity_id: assessment.activity_id,
    activity_version: assessment.activity_version,
    parameters: { ...assessment.parameters },
    order: assessment.order,
  };
}

function normalizePackages(protocol: StudyProtocol): EditablePackage[] {
  if (protocol.packages && protocol.packages.length > 0) {
    return protocol.packages.map((pkg) => ({
      ...pkg,
      localId: makeLocalId(),
      assessments: pkg.assessments.map((assessment) => ({
        ...assessment,
        parameters: { ...assessment.parameters },
      })),
      survey_item_refs: pkg.survey_item_refs.map((item) => item.item_id),
    }));
  }

  return [
    {
      localId: makeLocalId(),
      package_id: protocol.default_package_id ?? "default-package",
      package_name: "Default Package",
      package_version: 1,
      assessments: protocol.assessments.map(toPackageAssessment),
      survey_item_refs: protocol.ema_survey.items.map((item) => item.item_id),
    },
  ];
}

function toEditableTimeBlock(block: TimeBlock): EditableTimeBlock {
  return { ...block, localId: makeLocalId() };
}

function normalizeScheduleRules(
  protocol: StudyProtocol,
  packageIdFallback?: string,
): EditableScheduleRule[] {
  if (protocol.schedule_rules && protocol.schedule_rules.length > 0) {
    return protocol.schedule_rules.map((rule) => ({
      ...rule,
      localId: makeLocalId(),
      time_blocks: rule.time_blocks.map(toEditableTimeBlock),
    }));
  }

  return [
    {
      localId: makeLocalId(),
      rule_id: "default-rule",
      package_id:
        packageIdFallback ?? protocol.default_package_id ?? "default-package",
      schedule_mode: protocol.schedule.schedule_mode,
      prompts_per_day: protocol.schedule.prompts_per_day,
      min_gap_minutes: protocol.schedule.min_gap_minutes,
      expiry_minutes: protocol.schedule.expiry_minutes,
      time_blocks: (
        protocol.schedule.time_blocks ??
        protocol.schedule.windows ??
        []
      ).map(toEditableTimeBlock),
    },
  ];
}

export function loadSavedProtocol(): StudyProtocol | null {
  const raw = window.localStorage.getItem(DEV_PROTOCOL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudyProtocol;
  } catch {
    return null;
  }
}

export function saveProtocol(protocol: StudyProtocol) {
  window.localStorage.setItem(
    DEV_PROTOCOL_STORAGE_KEY,
    JSON.stringify(protocol),
  );
}

function buildDefaultAssessment(
  activityId: PackageAssessment["activity_id"],
): PackageAssessment {
  const definition = ASSESSMENT_LIBRARY.find(
    (candidate) => candidate.activity_id === activityId,
  );
  return {
    activity_id: activityId,
    activity_version: "latest",
    parameters: { ...(definition?.defaultParameters ?? {}) },
    order: 0,
  };
}

function buildInitialState(protocol: StudyProtocol): SetupState {
  const questionBank = normalizeQuestionBank(protocol);
  const packages = normalizePackages(protocol);

  return {
    study_id: protocol.study_id,
    study_uuid: protocol.study_uuid,
    version: protocol.version,
    default_package_id: protocol.default_package_id ?? packages[0]?.package_id,
    start_date: protocol.schedule.start_date,
    end_date: protocol.schedule.end_date,
    days_total: protocol.schedule.days_total,
    questionBank,
    packages,
    scheduleRules: normalizeScheduleRules(protocol, packages[0]?.package_id),
    surveyChrome: {
      survey_id: protocol.ema_survey.survey_id,
      title: protocol.ema_survey.title,
      instruction: protocol.ema_survey.instruction,
      submit_button_text: protocol.ema_survey.submit_button_text,
      unanswered_warning_text: protocol.ema_survey.unanswered_warning_text,
      answer_choice_label: protocol.ema_survey.answer_choice_label,
      skip_choice_label: protocol.ema_survey.skip_choice_label,
    },
    context_collection: cloneProtocol(protocol).context_collection,
  };
}

function getSortedAssessments(
  assessments: PackageAssessment[],
): PackageAssessment[] {
  return assessments
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((assessment, index) => ({ ...assessment, order: index }));
}

function toQuestionBankItems(
  items: EditableQuestionBankItem[],
): QuestionBankItem[] {
  return items.map(({ localId: _localId, ...item }) => item);
}

function buildWarningMessage(state: SetupState): string {
  const duplicateQuestionIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  state.questionBank.forEach((item) => {
    if (seenQuestionIds.has(item.item_id))
      duplicateQuestionIds.add(item.item_id);
    seenQuestionIds.add(item.item_id);
  });
  if (duplicateQuestionIds.size > 0) {
    return "Duplicate question item IDs detected. Item IDs must be unique and stable.";
  }

  const duplicatePackageIds = new Set<string>();
  const seenPackageIds = new Set<string>();
  state.packages.forEach((pkg) => {
    if (seenPackageIds.has(pkg.package_id))
      duplicatePackageIds.add(pkg.package_id);
    seenPackageIds.add(pkg.package_id);
  });
  if (duplicatePackageIds.size > 0) {
    return "Duplicate package IDs detected. Package IDs must be unique.";
  }

  const duplicateRuleIds = new Set<string>();
  const seenRuleIds = new Set<string>();
  state.scheduleRules.forEach((rule) => {
    if (seenRuleIds.has(rule.rule_id)) duplicateRuleIds.add(rule.rule_id);
    seenRuleIds.add(rule.rule_id);
  });
  if (duplicateRuleIds.size > 0) {
    return "Duplicate schedule rule IDs detected. Rule IDs must be unique.";
  }

  const questionIds = new Set(state.questionBank.map((item) => item.item_id));
  const packageIds = new Set(state.packages.map((pkg) => pkg.package_id));

  if (
    state.packages.some((pkg) =>
      pkg.survey_item_refs.some((itemId) => !questionIds.has(itemId)),
    )
  ) {
    return "A package references a question that is not present in the question bank.";
  }

  if (state.scheduleRules.some((rule) => !packageIds.has(rule.package_id))) {
    return "A schedule rule references a package ID that does not exist.";
  }

  if (state.default_package_id && !packageIds.has(state.default_package_id)) {
    return "Default package ID must match one of the defined packages.";
  }

  if (
    calculateInclusiveDayCount(state.start_date ?? "", state.end_date ?? "") ===
      null &&
    Boolean(state.start_date || state.end_date)
  ) {
    return "Start and end dates must form a valid calendar range.";
  }

  if (
    state.packages.some((pkg) =>
      pkg.assessments.some((assessment) => {
        if (assessment.activity_id !== "color-shapes") return false;
        const trials = Number(assessment.parameters.number_of_trials ?? 0);
        const different = Number(
          assessment.parameters.number_of_different_colors_trials ?? 0,
        );
        return different > trials;
      }),
    )
  ) {
    return "Color Shapes cannot have more different-colors trials than total trials.";
  }

  return "";
}

function buildProtocolFromState(state: SetupState): StudyProtocol {
  const daysTotal =
    calculateInclusiveDayCount(state.start_date ?? "", state.end_date ?? "") ??
    state.days_total;
  const questionBank = toQuestionBankItems(state.questionBank);
  const packages: StudyPackage[] = state.packages.map((pkg) => ({
    package_id: pkg.package_id,
    package_name: pkg.package_name,
    package_version: pkg.package_version,
    assessments: getSortedAssessments(pkg.assessments),
    survey_item_refs: pkg.survey_item_refs.map((item_id) => ({ item_id })),
  }));
  const defaultPackage =
    packages.find((pkg) => pkg.package_id === state.default_package_id) ??
    packages[0];
  const fallbackRule =
    state.scheduleRules.find(
      (rule) => rule.package_id === defaultPackage?.package_id,
    ) ?? state.scheduleRules[0];
  const fallbackBlocks =
    fallbackRule?.time_blocks.map(({ localId: _localId, ...block }) => block) ??
    [];

  return {
    study_id: state.study_id,
    study_uuid: state.study_uuid,
    version: state.version,
    schedule: {
      schedule_mode: fallbackRule?.schedule_mode ?? "random_block",
      time_blocks: fallbackBlocks,
      windows: fallbackBlocks,
      prompts_per_day: fallbackRule?.prompts_per_day ?? 1,
      randomize_within_window:
        (fallbackRule?.schedule_mode ?? "random_block") === "random_block",
      expiry_minutes: fallbackRule?.expiry_minutes ?? 30,
      start_date: state.start_date,
      end_date: state.end_date,
      days_total: daysTotal,
      min_gap_minutes: fallbackRule?.min_gap_minutes ?? 30,
    },
    question_bank: questionBank,
    packages,
    schedule_rules: state.scheduleRules.map((rule) => ({
      rule_id: rule.rule_id,
      package_id: rule.package_id,
      schedule_mode: rule.schedule_mode,
      prompts_per_day: rule.prompts_per_day,
      min_gap_minutes: rule.min_gap_minutes,
      expiry_minutes: rule.expiry_minutes,
      time_blocks: rule.time_blocks.map(
        ({ localId: _localId, ...block }) => block,
      ),
    })),
    default_package_id: defaultPackage?.package_id,
    assessments: defaultPackage
      ? defaultPackage.assessments.map((assessment) => ({
          activity_id: assessment.activity_id,
          activity_version: assessment.activity_version,
          parameters: { ...assessment.parameters },
          selection_strategy: "all",
          order: assessment.order,
        }))
      : [],
    ema_survey: {
      survey_id: state.surveyChrome.survey_id,
      survey_version: state.version,
      title: state.surveyChrome.title,
      instruction: state.surveyChrome.instruction,
      submit_button_text: state.surveyChrome.submit_button_text,
      unanswered_warning_text: state.surveyChrome.unanswered_warning_text,
      answer_choice_label: state.surveyChrome.answer_choice_label,
      skip_choice_label: state.surveyChrome.skip_choice_label,
      items: questionBank
        .filter((item) => item.status !== "hidden")
        .map(({ status: _status, ...item }) => item),
    },
    context_collection: state.context_collection,
  };
}

function addVersionBump(state: SetupState) {
  state.version += 1;
}

export function mountSetupUI(
  root: HTMLElement,
  initialProtocol: StudyProtocol,
  onSave: (protocol: StudyProtocol) => void,
) {
  const state = buildInitialState(initialProtocol);

  root.innerHTML = `
    <section class="setup-shell">
      <div class="setup-hero">
        <h2>EMA Study Setup</h2>
        <p>Author the question bank, named packages, and schedule rules, then save the package-based protocol into the current app session.</p>
      </div>
      <div class="setup-grid">
        <section class="setup-panel setup-form"></section>
        <aside class="setup-panel setup-preview">
          <h3>Protocol Preview</h3>
          <div class="setup-warning" id="setup-warning"></div>
          <pre id="setup-preview"></pre>
        </aside>
      </div>
    </section>
  `;

  const formEl = root.querySelector(".setup-form") as HTMLDivElement;
  const warningEl = root.querySelector("#setup-warning") as HTMLDivElement;
  const previewEl = root.querySelector("#setup-preview") as HTMLPreElement;

  const renderPreview = () => {
    warningEl.textContent = buildWarningMessage(state);
    previewEl.textContent = JSON.stringify(
      buildProtocolFromState(state),
      null,
      2,
    );
  };

  const render = () => {
    formEl.innerHTML = `
      <div class="setup-section">
        <h3>Module Library</h3>
        <div class="setup-pill-row">
          ${ASSESSMENT_LIBRARY.map(
            (assessment) =>
              `<span class="setup-pill">${escapeHtml(assessment.label)}</span>`,
          ).join("")}
        </div>
      </div>

      <div class="setup-section">
        <h3>Study Core</h3>
        <label class="setup-field">
          <span>Study ID</span>
          <input id="setup-study-id" value="${escapeHtml(state.study_id)}" />
        </label>
        <label class="setup-field">
          <span>Protocol Version</span>
          <input id="setup-version" type="number" min="1" value="${state.version}" />
        </label>
        <label class="setup-field">
          <span>Default Package</span>
          <select id="setup-default-package">
            ${state.packages
              .map(
                (pkg) => `
                  <option
                    value="${escapeHtml(pkg.package_id)}"
                    ${pkg.package_id === state.default_package_id ? "selected" : ""}
                  >
                    ${escapeHtml(pkg.package_name)} (${escapeHtml(pkg.package_id)})
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>

      <div class="setup-section">
        <h3>Survey Chrome</h3>
        <label class="setup-field">
          <span>Survey ID</span>
          <input id="setup-survey-id" value="${escapeHtml(state.surveyChrome.survey_id)}" />
        </label>
        <label class="setup-field">
          <span>Survey Title</span>
          <input id="setup-survey-title" value="${escapeHtml(state.surveyChrome.title)}" />
        </label>
        <label class="setup-field">
          <span>Instruction</span>
          <textarea id="setup-instruction">${escapeHtml(state.surveyChrome.instruction)}</textarea>
        </label>
        <label class="setup-field">
          <span>Warning Text</span>
          <input id="setup-warning-text" value="${escapeHtml(state.surveyChrome.unanswered_warning_text)}" />
        </label>
      </div>

      <div class="setup-section">
        <h3>Study Calendar</h3>
        <div class="setup-row">
          <label class="setup-field">
            <span>Start Date</span>
            <input id="setup-start-date" type="date" value="${escapeHtml(state.start_date)}" />
          </label>
          <label class="setup-field">
            <span>End Date</span>
            <input id="setup-end-date" type="date" value="${escapeHtml(state.end_date)}" />
          </label>
        </div>
        <label class="setup-field">
          <span>Study Duration Days</span>
          <input id="setup-days-total" type="number" min="1" value="${state.days_total}" />
        </label>
      </div>

      <div class="setup-section">
        <div class="setup-subsection-head">
          <h3>Question Bank</h3>
          <div class="setup-actions">
            <button id="setup-add-slider" type="button">Add Slider</button>
            <button id="setup-add-text" type="button" class="secondary">Add Text</button>
          </div>
        </div>
        <div id="setup-question-bank" class="setup-stack"></div>
      </div>

      <div class="setup-section">
        <div class="setup-subsection-head">
          <h3>Packages</h3>
          <div class="setup-actions">
            <button id="setup-add-package" type="button">Add Package</button>
          </div>
        </div>
        <div id="setup-packages" class="setup-stack"></div>
      </div>

      <div class="setup-section">
        <div class="setup-subsection-head">
          <h3>Schedule Rules</h3>
          <div class="setup-actions">
            <button id="setup-add-rule" type="button">Add Rule</button>
          </div>
        </div>
        <div id="setup-rules" class="setup-stack"></div>
      </div>

      <div class="setup-actions">
        <button id="setup-save" type="button">Save Protocol</button>
      </div>
    `;

    const questionBankEl = formEl.querySelector(
      "#setup-question-bank",
    ) as HTMLDivElement;
    const packagesEl = formEl.querySelector(
      "#setup-packages",
    ) as HTMLDivElement;
    const rulesEl = formEl.querySelector("#setup-rules") as HTMLDivElement;

    questionBankEl.innerHTML = state.questionBank
      .map((item) => {
        const details =
          item.kind === "slider"
            ? `
              <div class="setup-row">
                <label class="setup-field">
                  <span>Min</span>
                  <input data-question="${item.localId}" data-role="min" type="number" value="${item.min}" />
                </label>
                <label class="setup-field">
                  <span>Max</span>
                  <input data-question="${item.localId}" data-role="max" type="number" value="${item.max}" />
                </label>
              </div>
              <div class="setup-row">
                <label class="setup-field">
                  <span>Min Label</span>
                  <input data-question="${item.localId}" data-role="min-label" value="${escapeHtml(item.min_label)}" />
                </label>
                <label class="setup-field">
                  <span>Max Label</span>
                  <input data-question="${item.localId}" data-role="max-label" value="${escapeHtml(item.max_label)}" />
                </label>
              </div>
            `
            : `
              <label class="setup-field">
                <span>Placeholder</span>
                <input data-question="${item.localId}" data-role="placeholder" value="${escapeHtml(item.placeholder)}" />
              </label>
            `;

        return `
          <section class="setup-card">
            <h4>${item.kind === "slider" ? "Slider Question" : "Text Question"}</h4>
            <label class="setup-field">
              <span>Item ID</span>
              <input data-question="${item.localId}" data-role="item-id" value="${escapeHtml(item.item_id)}" />
            </label>
            <label class="setup-field">
              <span>Prompt</span>
              <textarea data-question="${item.localId}" data-role="prompt">${escapeHtml(item.prompt)}</textarea>
            </label>
            <label class="setup-field">
              <span>Status</span>
              <select data-question="${item.localId}" data-role="status">
                <option value="active" ${item.status === "active" ? "selected" : ""}>Active</option>
                <option value="hidden" ${item.status === "hidden" ? "selected" : ""}>Hidden</option>
              </select>
            </label>
            ${details}
            <div class="setup-actions">
              <button type="button" class="secondary" data-question="${item.localId}" data-role="remove-question">Remove Question</button>
            </div>
          </section>
        `;
      })
      .join("");

    packagesEl.innerHTML = state.packages
      .map((pkg) => {
        const assessmentRows = ASSESSMENT_LIBRARY.map((definition) => {
          const assessment = pkg.assessments.find(
            (candidate) => candidate.activity_id === definition.activity_id,
          );
          const enabled = Boolean(assessment);
          const trials = Number(assessment?.parameters.number_of_trials ?? 3);
          const differentColors = Number(
            assessment?.parameters.number_of_different_colors_trials ?? 2,
          );
          const showDifferentColors = definition.activity_id === "color-shapes";
          return `
            <section class="setup-card">
              <div class="setup-row">
                <label class="setup-pill">
                  <input
                    type="checkbox"
                    data-package="${pkg.localId}"
                    data-assessment="${definition.activity_id}"
                    data-role="assessment-enabled"
                    ${enabled ? "checked" : ""}
                  />
                  ${escapeHtml(definition.label)}
                </label>
              </div>
              <div class="setup-row">
                <label class="setup-field">
                  <span>Trials</span>
                  <input
                    data-package="${pkg.localId}"
                    data-assessment="${definition.activity_id}"
                    data-role="number-of-trials"
                    type="number"
                    min="1"
                    value="${trials}"
                    ${enabled ? "" : "disabled"}
                  />
                </label>
                ${
                  showDifferentColors
                    ? `
                      <label class="setup-field">
                        <span>Different Colors Trials</span>
                        <input
                          data-package="${pkg.localId}"
                          data-assessment="${definition.activity_id}"
                          data-role="different-colors"
                          type="number"
                          min="1"
                          value="${differentColors}"
                          ${enabled ? "" : "disabled"}
                        />
                      </label>
                    `
                    : ""
                }
              </div>
            </section>
          `;
        }).join("");

        const questionRows = state.questionBank
          .map((item) => {
            const selected = pkg.survey_item_refs.includes(item.item_id);
            return `
              <label class="setup-pill">
                <input
                  type="checkbox"
                  data-package="${pkg.localId}"
                  data-item-id="${escapeHtml(item.item_id)}"
                  data-role="package-question"
                  ${selected ? "checked" : ""}
                />
                ${escapeHtml(item.item_id)}${item.status === "hidden" ? " (hidden)" : ""}
              </label>
            `;
          })
          .join("");

        return `
          <section class="setup-card">
            <h4>Package</h4>
            <label class="setup-field">
              <span>Package ID</span>
              <input data-package="${pkg.localId}" data-role="package-id" value="${escapeHtml(pkg.package_id)}" />
            </label>
            <label class="setup-field">
              <span>Package Name</span>
              <input data-package="${pkg.localId}" data-role="package-name" value="${escapeHtml(pkg.package_name)}" />
            </label>
            <label class="setup-field">
              <span>Package Version</span>
              <input data-package="${pkg.localId}" data-role="package-version" type="number" min="1" value="${pkg.package_version}" />
            </label>
            <div class="setup-subsection">
              <h4>Assessments</h4>
              <div class="setup-stack">${assessmentRows}</div>
            </div>
            <div class="setup-subsection">
              <h4>Question Selection</h4>
              <div class="setup-pill-row">${questionRows}</div>
            </div>
            <div class="setup-actions">
              <button type="button" class="secondary" data-package="${pkg.localId}" data-role="remove-package">Remove Package</button>
            </div>
          </section>
        `;
      })
      .join("");

    rulesEl.innerHTML = state.scheduleRules
      .map((rule) => {
        const blockRows = rule.time_blocks
          .map(
            (block) => `
              <section class="setup-card">
                <div class="setup-row">
                  <label class="setup-field">
                    <span>Start</span>
                    <input data-rule="${rule.localId}" data-block="${block.localId}" data-role="block-start" type="time" value="${escapeHtml(block.start)}" />
                  </label>
                  <label class="setup-field">
                    <span>End</span>
                    <input data-rule="${rule.localId}" data-block="${block.localId}" data-role="block-end" type="time" value="${escapeHtml(block.end)}" />
                  </label>
                </div>
                <div class="setup-actions">
                  <button type="button" class="secondary" data-rule="${rule.localId}" data-block="${block.localId}" data-role="remove-block">Remove Block</button>
                </div>
              </section>
            `,
          )
          .join("");

        return `
          <section class="setup-card">
            <h4>Schedule Rule</h4>
            <label class="setup-field">
              <span>Rule ID</span>
              <input data-rule="${rule.localId}" data-role="rule-id" value="${escapeHtml(rule.rule_id)}" />
            </label>
            <label class="setup-field">
              <span>Package</span>
              <select data-rule="${rule.localId}" data-role="rule-package-id">
                ${state.packages
                  .map(
                    (pkg) => `
                      <option value="${escapeHtml(pkg.package_id)}" ${pkg.package_id === rule.package_id ? "selected" : ""}>
                        ${escapeHtml(pkg.package_name)} (${escapeHtml(pkg.package_id)})
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="setup-field">
              <span>Schedule Mode</span>
              <select data-rule="${rule.localId}" data-role="rule-mode">
                <option value="random_block" ${rule.schedule_mode === "random_block" ? "selected" : ""}>Random Block</option>
                <option value="fixed_time" ${rule.schedule_mode === "fixed_time" ? "selected" : ""}>Fixed Time</option>
                <option value="event_contingent" ${rule.schedule_mode === "event_contingent" ? "selected" : ""}>Event Contingent</option>
              </select>
            </label>
            <div class="setup-row">
              <label class="setup-field">
                <span>Prompts Per Day</span>
                <input data-rule="${rule.localId}" data-role="rule-prompts" type="number" min="1" value="${rule.prompts_per_day}" />
              </label>
              <label class="setup-field">
                <span>Minimum Gap Minutes</span>
                <input data-rule="${rule.localId}" data-role="rule-gap" type="number" min="1" value="${rule.min_gap_minutes}" />
              </label>
              <label class="setup-field">
                <span>Expiry Minutes</span>
                <input data-rule="${rule.localId}" data-role="rule-expiry" type="number" min="1" value="${rule.expiry_minutes}" />
              </label>
            </div>
            <div class="setup-subsection">
              <div class="setup-subsection-head">
                <h4>Time Blocks</h4>
                <div class="setup-actions">
                  <button type="button" data-rule="${rule.localId}" data-role="add-block">Add Block</button>
                </div>
              </div>
              <div class="setup-stack">${blockRows}</div>
            </div>
            <div class="setup-actions">
              <button type="button" class="secondary" data-rule="${rule.localId}" data-role="remove-rule">Remove Rule</button>
            </div>
          </section>
        `;
      })
      .join("");

    formEl
      .querySelector("#setup-study-id")
      ?.addEventListener("input", (event) => {
        state.study_id = (event.target as HTMLInputElement).value.trim();
        renderPreview();
      });

    formEl
      .querySelector("#setup-version")
      ?.addEventListener("input", (event) => {
        state.version = Number((event.target as HTMLInputElement).value);
        renderPreview();
      });

    formEl
      .querySelector("#setup-default-package")
      ?.addEventListener("input", (event) => {
        state.default_package_id = (event.target as HTMLSelectElement).value;
        renderPreview();
      });

    [
      ["#setup-survey-id", "survey_id"],
      ["#setup-survey-title", "title"],
      ["#setup-warning-text", "unanswered_warning_text"],
    ].forEach(([selector, key]) => {
      formEl.querySelector(selector)?.addEventListener("input", (event) => {
        (state.surveyChrome as Record<string, unknown>)[key] = (
          event.target as HTMLInputElement
        ).value;
        renderPreview();
      });
    });

    formEl
      .querySelector("#setup-instruction")
      ?.addEventListener("input", (event) => {
        state.surveyChrome.instruction = (
          event.target as HTMLTextAreaElement
        ).value;
        renderPreview();
      });

    formEl
      .querySelector("#setup-start-date")
      ?.addEventListener("input", (event) => {
        state.start_date = (event.target as HTMLInputElement).value;
        const daysTotal = calculateInclusiveDayCount(
          state.start_date ?? "",
          state.end_date ?? "",
        );
        if (daysTotal !== null) {
          state.days_total = daysTotal;
          const daysInput = formEl.querySelector(
            "#setup-days-total",
          ) as HTMLInputElement | null;
          if (daysInput) daysInput.value = String(daysTotal);
        }
        renderPreview();
      });

    formEl
      .querySelector("#setup-end-date")
      ?.addEventListener("input", (event) => {
        state.end_date = (event.target as HTMLInputElement).value;
        const daysTotal = calculateInclusiveDayCount(
          state.start_date ?? "",
          state.end_date ?? "",
        );
        if (daysTotal !== null) {
          state.days_total = daysTotal;
          const daysInput = formEl.querySelector(
            "#setup-days-total",
          ) as HTMLInputElement | null;
          if (daysInput) daysInput.value = String(daysTotal);
        }
        renderPreview();
      });

    formEl
      .querySelector("#setup-days-total")
      ?.addEventListener("input", (event) => {
        state.days_total = Number((event.target as HTMLInputElement).value);
        renderPreview();
      });

    questionBankEl
      .querySelectorAll<HTMLElement>("[data-question]")
      .forEach((el) => {
        const questionId = el.dataset.question;
        const question = state.questionBank.find(
          (candidate) => candidate.localId === questionId,
        );
        if (!question) return;

        if (el.dataset.role === "remove-question") {
          el.addEventListener("click", () => {
            state.questionBank = state.questionBank.filter(
              (candidate) => candidate.localId !== questionId,
            );
            state.packages = state.packages.map((pkg) => ({
              ...pkg,
              survey_item_refs: pkg.survey_item_refs.filter(
                (itemId) => itemId !== question.item_id,
              ),
            }));
            addVersionBump(state);
            render();
            renderPreview();
          });
          return;
        }

        el.addEventListener("input", (event) => {
          const value = (
            event.target as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement
          ).value;
          const previousItemId = question.item_id;
          switch (el.dataset.role) {
            case "item-id":
              question.item_id = value.trim();
              state.packages = state.packages.map((pkg) => ({
                ...pkg,
                survey_item_refs: pkg.survey_item_refs.map((itemId) =>
                  itemId === previousItemId ? question.item_id : itemId,
                ),
              }));
              break;
            case "prompt":
              question.prompt = value;
              break;
            case "status":
              question.status = value as "active" | "hidden";
              break;
            case "min":
              if (question.kind === "slider") question.min = Number(value);
              break;
            case "max":
              if (question.kind === "slider") question.max = Number(value);
              break;
            case "min-label":
              if (question.kind === "slider") question.min_label = value;
              break;
            case "max-label":
              if (question.kind === "slider") question.max_label = value;
              break;
            case "placeholder":
              if (question.kind === "text") question.placeholder = value;
              break;
          }
          renderPreview();
        });
      });

    packagesEl.querySelectorAll<HTMLElement>("[data-package]").forEach((el) => {
      const packageLocalId = el.dataset.package;
      const pkg = state.packages.find(
        (candidate) => candidate.localId === packageLocalId,
      );
      if (!pkg) return;

      if (el.dataset.role === "remove-package") {
        el.addEventListener("click", () => {
          state.packages = state.packages.filter(
            (candidate) => candidate.localId !== packageLocalId,
          );
          state.scheduleRules = state.scheduleRules.filter(
            (rule) => rule.package_id !== pkg.package_id,
          );
          if (state.default_package_id === pkg.package_id) {
            state.default_package_id = state.packages[0]?.package_id;
          }
          addVersionBump(state);
          render();
          renderPreview();
        });
        return;
      }

      if (el.dataset.role === "assessment-enabled") {
        el.addEventListener("input", (event) => {
          const input = event.target as HTMLInputElement;
          const assessmentId = el.dataset
            .assessment as PackageAssessment["activity_id"];
          if (input.checked) {
            if (
              !pkg.assessments.some(
                (assessment) => assessment.activity_id === assessmentId,
              )
            ) {
              pkg.assessments = getSortedAssessments(
                pkg.assessments.concat({
                  ...buildDefaultAssessment(assessmentId),
                  order: pkg.assessments.length,
                }),
              );
            }
          } else {
            pkg.assessments = getSortedAssessments(
              pkg.assessments.filter(
                (assessment) => assessment.activity_id !== assessmentId,
              ),
            );
          }
          addVersionBump(state);
          render();
          renderPreview();
        });
        return;
      }

      if (el.dataset.role === "package-question") {
        el.addEventListener("input", (event) => {
          const input = event.target as HTMLInputElement;
          const itemId = el.dataset.itemId ?? "";
          pkg.survey_item_refs = input.checked
            ? Array.from(new Set(pkg.survey_item_refs.concat(itemId)))
            : pkg.survey_item_refs.filter((candidate) => candidate !== itemId);
          renderPreview();
        });
        return;
      }

      el.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement | HTMLSelectElement)
          .value;
        switch (el.dataset.role) {
          case "package-id": {
            const previousPackageId = pkg.package_id;
            pkg.package_id = value.trim();
            if (state.default_package_id === previousPackageId) {
              state.default_package_id = pkg.package_id;
            }
            state.scheduleRules = state.scheduleRules.map((rule) => ({
              ...rule,
              package_id:
                rule.package_id === previousPackageId
                  ? pkg.package_id
                  : rule.package_id,
            }));
            break;
          }
          case "package-name":
            pkg.package_name = value;
            break;
          case "package-version":
            pkg.package_version = Number(value);
            break;
          case "number-of-trials": {
            const assessmentId = el.dataset
              .assessment as PackageAssessment["activity_id"];
            const assessment = pkg.assessments.find(
              (candidate) => candidate.activity_id === assessmentId,
            );
            if (assessment) {
              assessment.parameters.number_of_trials = Number(value);
            }
            break;
          }
          case "different-colors": {
            const assessmentId = el.dataset
              .assessment as PackageAssessment["activity_id"];
            const assessment = pkg.assessments.find(
              (candidate) => candidate.activity_id === assessmentId,
            );
            if (assessment) {
              assessment.parameters.number_of_different_colors_trials =
                Number(value);
            }
            break;
          }
        }
        renderPreview();
      });
    });

    rulesEl.querySelectorAll<HTMLElement>("[data-rule]").forEach((el) => {
      const ruleLocalId = el.dataset.rule;
      const rule = state.scheduleRules.find(
        (candidate) => candidate.localId === ruleLocalId,
      );
      if (!rule) return;

      if (el.dataset.role === "remove-rule") {
        el.addEventListener("click", () => {
          state.scheduleRules = state.scheduleRules.filter(
            (candidate) => candidate.localId !== ruleLocalId,
          );
          addVersionBump(state);
          render();
          renderPreview();
        });
        return;
      }

      if (el.dataset.role === "add-block") {
        el.addEventListener("click", () => {
          rule.time_blocks = rule.time_blocks.concat({
            localId: makeLocalId(),
            start: "09:00",
            end: "12:00",
          });
          render();
          renderPreview();
        });
        return;
      }

      if (el.dataset.role === "remove-block") {
        el.addEventListener("click", () => {
          const blockId = el.dataset.block;
          rule.time_blocks = rule.time_blocks.filter(
            (block) => block.localId !== blockId,
          );
          render();
          renderPreview();
        });
        return;
      }

      el.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement | HTMLSelectElement)
          .value;
        switch (el.dataset.role) {
          case "rule-id":
            rule.rule_id = value.trim();
            break;
          case "rule-package-id":
            rule.package_id = value;
            break;
          case "rule-mode":
            rule.schedule_mode = value as ScheduleRule["schedule_mode"];
            break;
          case "rule-prompts":
            rule.prompts_per_day = Number(value);
            break;
          case "rule-gap":
            rule.min_gap_minutes = Number(value);
            break;
          case "rule-expiry":
            rule.expiry_minutes = Number(value);
            break;
          case "block-start": {
            const block = rule.time_blocks.find(
              (candidate) => candidate.localId === el.dataset.block,
            );
            if (block) block.start = value;
            break;
          }
          case "block-end": {
            const block = rule.time_blocks.find(
              (candidate) => candidate.localId === el.dataset.block,
            );
            if (block) block.end = value;
            break;
          }
        }
        renderPreview();
      });
    });

    formEl.querySelector("#setup-add-slider")?.addEventListener("click", () => {
      state.questionBank = state.questionBank.concat({
        localId: makeLocalId(),
        item_id: `item_${state.questionBank.length + 1}`,
        kind: "slider",
        prompt: "New EMA slider question",
        min: 0,
        max: 100,
        min_label: "Low",
        max_label: "High",
        status: "active",
      });
      addVersionBump(state);
      render();
      renderPreview();
    });

    formEl.querySelector("#setup-add-text")?.addEventListener("click", () => {
      state.questionBank = state.questionBank.concat({
        localId: makeLocalId(),
        item_id: `item_${state.questionBank.length + 1}`,
        kind: "text",
        prompt: "New EMA text question",
        placeholder: "Type your response",
        status: "active",
      });
      addVersionBump(state);
      render();
      renderPreview();
    });

    formEl
      .querySelector("#setup-add-package")
      ?.addEventListener("click", () => {
        const nextIndex = state.packages.length + 1;
        const packageId = `package-${nextIndex}`;
        state.packages = state.packages.concat({
          localId: makeLocalId(),
          package_id: packageId,
          package_name: `Package ${nextIndex}`,
          package_version: 1,
          assessments: [],
          survey_item_refs: [],
        });
        if (!state.default_package_id) {
          state.default_package_id = packageId;
        }
        addVersionBump(state);
        render();
        renderPreview();
      });

    formEl.querySelector("#setup-add-rule")?.addEventListener("click", () => {
      const nextIndex = state.scheduleRules.length + 1;
      state.scheduleRules = state.scheduleRules.concat({
        localId: makeLocalId(),
        rule_id: `rule-${nextIndex}`,
        package_id:
          state.default_package_id ??
          state.packages[0]?.package_id ??
          "package-1",
        schedule_mode: "random_block",
        prompts_per_day: 1,
        min_gap_minutes: 30,
        expiry_minutes: 30,
        time_blocks: [{ localId: makeLocalId(), start: "09:00", end: "12:00" }],
      });
      addVersionBump(state);
      render();
      renderPreview();
    });

    formEl.querySelector("#setup-save")?.addEventListener("click", () => {
      const protocol = buildProtocolFromState(state);
      saveProtocol(protocol);
      onSave(protocol);
      renderPreview();
    });
  };

  render();
  renderPreview();
}
