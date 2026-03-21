# EMA App — Study Protocol Configuration Guide

This app is a research data collection system for participant EMA sessions.

The current product model is **package-based**, not one fixed battery per prompt.

Each scheduled or manually launched prompt should run a **named package**. A package can contain:

- any subset of the fixed cognitive modules:
  - `color-dots`
  - `color-shapes`
  - `grid-memory`
  - `symbol-search`
- any subset of EMA questions selected question-by-question from the question bank
- multiple EMA question groups in the same package

Examples:

- `Morning Survey` -> EMA only
- `Random Cognition A` -> cognition only
- `Evening Mixed` -> cognition + EMA questions

The protocol is represented by `StudyProtocol` in [contracts/study-protocol.schema.ts](/Users/jongwonlee/gitrepos/m2c2kit/ema-app/contracts/study-protocol.schema.ts).

---

## 1. Cognitive Module Library

The available cognitive module library is fixed to these 4 assessments:

| `activity_id`   | Name          | What it measures                     |
| --------------- | ------------- | ------------------------------------ |
| `color-dots`    | Color Dots    | Spatial working memory               |
| `color-shapes`  | Color Shapes  | Visual change detection              |
| `grid-memory`   | Grid Memory   | Spatial working memory (grid recall) |
| `symbol-search` | Symbol Search | Processing speed / visual search     |

Typical EMA-safe module configuration:

```json
"assessments": [
  {
    "activity_id": "color-dots",
    "activity_version": "0.8.34",
    "selection_strategy": "all",
    "order": 0,
    "parameters": {
      "number_of_trials": 3,
      "scoring": true,
      "show_instructions": false
    }
  },
  {
    "activity_id": "color-shapes",
    "activity_version": "0.8.34",
    "selection_strategy": "all",
    "order": 1,
    "parameters": {
      "number_of_trials": 3,
      "number_of_different_colors_trials": 2,
      "scoring": true,
      "show_instructions": false
    }
  },
  {
    "activity_id": "grid-memory",
    "activity_version": "0.8.34",
    "selection_strategy": "all",
    "order": 2,
    "parameters": {
      "number_of_trials": 3,
      "scoring": true,
      "show_instructions": false
    }
  },
  {
    "activity_id": "symbol-search",
    "activity_version": "0.8.34",
    "selection_strategy": "all",
    "order": 3,
    "parameters": {
      "number_of_trials": 3,
      "scoring": true,
      "show_instructions": false
    }
  }
]
```

Notes:

- `show_instructions` should normally be `true` only for the participant's first exposure, then `false` for repeat EMA sessions.
- `color-shapes.number_of_different_colors_trials` must remain less than or equal to `number_of_trials`.
- Sessions should stay short. `3–5` trials per task is the intended EMA range.
- These modules are reusable building blocks. Researchers may create different task parameter presets in different packages.

---

## 2. Question Bank And EMA Content

EMA questions should be managed as a reusable question bank.

Core rules:

- each question has a stable `item_id`
- questions are selected question-by-question into packages
- questions are never hard-deleted once used in data collection
- questions should be `active` or `hidden`
- hidden questions remain valid historically and can be restored for future use

The EMA content currently lives in `ema_survey`, but the intended package-based architecture should evolve toward package-specific question selection.

Core properties:

| Field            | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `survey_id`      | Stable survey identifier                      |
| `survey_version` | Increment when survey structure changes       |
| `title`          | Researcher-facing survey title                |
| `instruction`    | Optional intro text shown before survey items |
| `items`          | Array of versioned survey items               |

Each item has a stable `item_id` and one of these `kind` values:

- `slider`
- `single_choice`
- `multi_choice`
- `text`

Example:

```json
"ema_survey": {
  "survey_id": "ema-mood-stress",
  "survey_version": 2,
  "title": "EMA Check-in",
  "instruction": "Please answer or skip each question before submitting the survey.",
  "unanswered_warning_text": "Please answer or skip all questions before submitting the survey.",
  "answer_choice_label": "Answer question",
  "skip_choice_label": "Skip question",
  "items": [
    {
      "item_id": "mood",
      "kind": "slider",
      "prompt": "How is your overall mood right now?",
      "min": 0,
      "max": 100,
      "min_label": "Very bad",
      "max_label": "Very good"
    },
    {
      "item_id": "stress",
      "kind": "slider",
      "prompt": "How stressed do you feel right now?",
      "min": 0,
      "max": 100,
      "min_label": "Not at all",
      "max_label": "Extremely"
    },
    {
      "item_id": "energy",
      "kind": "slider",
      "prompt": "How much energy do you have right now?",
      "min": 0,
      "max": 100,
      "min_label": "Very tired",
      "max_label": "Very energetic"
    }
  ]
}
```

---

## 3. Package Model

A package is the real participant-facing unit of delivery.

Each package should include:

- `package_id`
- `package_name`
- `package_version`
- selected cognitive modules with parameter presets
- selected EMA questions

Rules:

- researchers can name packages
- researchers can include only EMA, only cognition, or a mix
- package edits create new versions
- old package versions remain attached to old sessions

---

## 4. Survey Completion Rules

Each participant must explicitly dispose of every survey item.

Allowed final states per item:

- `answered`
- `skipped`

Not allowed:

- untouched / implicit missing

Required behavior:

- every item must provide a skip option
- survey submission is blocked while any item remains untouched
- the survey should warn the participant with copy such as:
  - `Answer this question or choose Skip.`
  - `Please answer or skip all questions before submitting the survey.`

This preserves interpretability in the exported dataset:

- `answered` means participant provided content
- `skipped` means participant explicitly declined to answer
- empty export values mean the item was not yet active in that survey version

---

## 5. Versioning And Mid-Study Changes

The survey must remain modifiable:

- before participants begin the protocol
- in the middle of an active protocol
- after the protocol for export compatibility and metadata interpretation

Rules:

- `survey_id` stays stable for the same conceptual survey
- `survey_version` increments whenever survey structure changes
- `item_id` must remain stable for the same question across versions
- new questions get new `item_id` values
- retired items should not have their old `item_id` reused for a new meaning

This versioning model is necessary for longitudinal export.

Package rules follow the same pattern:

- package versions should be immutable once used
- future edits create a new package version
- prior collected data must remain linked to historical package versions

---

## 6. Export Semantics

Exports must remain rectangular even when the survey changes over time.

Rules:

- export columns are the union of all `item_id` values seen across survey versions
- sessions collected before a later-added item existed must show an empty value for that item
- skipped responses must remain explicit and not be confused with empty values
- each normalized survey row should carry:
  - `prompt_id`
  - `session_uuid`
  - `survey_id`
  - `survey_version`
  - `item_id`
  - `response_status`
  - `response_value`

This distinction matters:

- empty = item not active yet
- skipped = active item explicitly skipped
- answered = active item answered

---

## 7. Scheduling

The default schedule mode is `random_block`, but scheduling should conceptually attach to **packages**, not directly to a single fixed battery.

In `random_block` mode:

- the researcher defines one or more allowable time blocks
- the app schedules prompts randomly within those blocks
- each schedule rule should point to a package
- prompt counts and minimum gaps still apply

Current contract fields:

| Field             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `schedule_mode`   | `random_block`, `fixed_time`, or future `event_contingent` |
| `time_blocks`     | Researcher-defined allowed delivery blocks                 |
| `prompts_per_day` | Number of prompts per day                                  |
| `min_gap_minutes` | Minimum gap between prompts                                |
| `expiry_minutes`  | Time allowed before a prompt expires                       |
| `days_total`      | Study duration                                             |

Example:

```json
"schedule": {
  "schedule_mode": "random_block",
  "time_blocks": [
    { "start": "09:00", "end": "12:00" },
    { "start": "14:00", "end": "20:00" }
  ],
  "prompts_per_day": 4,
  "min_gap_minutes": 60,
  "expiry_minutes": 30,
  "days_total": 14
}
```

Backward-compatible fields such as `windows` and `randomize_within_window` may still appear in existing configs, but new protocol authoring should target `schedule_mode` + `time_blocks`.

---

## 7. Future Extension

Future work may add `event_contingent` scheduling based on GPS or other context signals.

That is not part of the current launch scope, but the protocol contract reserves room for it so the scheduling model does not need to be redesigned later.
