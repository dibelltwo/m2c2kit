# EMA App — Study Protocol Configuration Guide

This document describes how to configure a study protocol: which cognitive assessments to include, how many trials to run, the order they appear, self-report questionnaires, and scheduling. All of these are controlled by a `StudyProtocol` object (defined in `contracts/study-protocol.schema.ts`) that is downloaded by the app from the backend at enrollment.

---

## 1. Cognitive Assessments

### Available assessments

| `activity_id`   | Name          | What it measures                     |
| --------------- | ------------- | ------------------------------------ |
| `color-dots`    | Color Dots    | Spatial working memory               |
| `color-shapes`  | Color Shapes  | Visual change detection              |
| `grid-memory`   | Grid Memory   | Spatial working memory (grid recall) |
| `symbol-search` | Symbol Search | Processing speed / visual search     |

### Modifiable parameters (all assessments)

| Parameter              | Type    | Default | Description                                                                |
| ---------------------- | ------- | ------- | -------------------------------------------------------------------------- |
| `number_of_trials`     | integer | 5       | How many trials to run per prompt. **Recommended: 3–5 for EMA.**           |
| `scoring`              | boolean | true    | Whether to compute and emit composite scoring data.                        |
| `show_instructions`    | boolean | false   | Show full instructions before the task. Set `true` for first session only. |
| `show_quit_button`     | boolean | false   | Show a quit/exit button during the task.                                   |
| `fixation_duration_ms` | number  | 500     | Duration of the fixation cross in ms.                                      |

### Assessment-specific constraints

#### `color-shapes` only

| Parameter                           | Type    | Default | Constraint                                                                                                                                                |
| ----------------------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number_of_different_colors_trials` | integer | 6       | **Must be ≤ `number_of_trials`**. Controls how many trials use shape-color changes. When reducing `number_of_trials` below 6, always set this explicitly. |

> **Bug note:** The `color-shapes` default `number_of_different_colors_trials: 6` is larger than its default `number_of_trials: 5`. This is a known upstream issue. Always override `number_of_different_colors_trials` when setting `number_of_trials < 6`.

**Safe EMA configuration for color-shapes:**

```json
{
  "activity_id": "color-shapes",
  "parameters": {
    "number_of_trials": 3,
    "number_of_different_colors_trials": 2,
    "scoring": true
  }
}
```

---

## 2. Assessment Selection Strategy

The `selection_strategy` field on each `AssessmentConfig` controls which assessments run at each prompt:

| Strategy      | Behavior                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `all`         | Run every assessment in the protocol at each prompt (in `order` sequence)                      |
| `round_robin` | Cycle through assessments across prompts (prompt 1 → assessment A, prompt 2 → assessment B, …) |
| `random_one`  | Pick one assessment at random per prompt                                                       |

**Example — round-robin across 4 assessments (one game per prompt):**

```json
"assessments": [
  { "activity_id": "color-dots",    "selection_strategy": "round_robin", "order": 0, "parameters": { "number_of_trials": 3 } },
  { "activity_id": "color-shapes",  "selection_strategy": "round_robin", "order": 1, "parameters": { "number_of_trials": 3, "number_of_different_colors_trials": 2 } },
  { "activity_id": "grid-memory",   "selection_strategy": "round_robin", "order": 2, "parameters": { "number_of_trials": 3 } },
  { "activity_id": "symbol-search", "selection_strategy": "round_robin", "order": 3, "parameters": { "number_of_trials": 3 } }
]
```

**Example — all 4 games every prompt:**

```json
"assessments": [
  { "activity_id": "color-dots",    "selection_strategy": "all", "order": 0, "parameters": { "number_of_trials": 3 } },
  { "activity_id": "color-shapes",  "selection_strategy": "all", "order": 1, "parameters": { "number_of_trials": 3, "number_of_different_colors_trials": 2 } },
  { "activity_id": "grid-memory",   "selection_strategy": "all", "order": 2, "parameters": { "number_of_trials": 3 } },
  { "activity_id": "symbol-search", "selection_strategy": "all", "order": 3, "parameters": { "number_of_trials": 3 } }
]
```

---

## 3. Self-Report Questionnaires _(not yet implemented)_

Self-report items (mood, stress, affect, context questions) are currently **missing** from the app. They will use the `@m2c2kit/survey` package (survey.js-based) as a survey `Activity` alongside the cognitive assessments.

### Planned integration

Each questionnaire will be defined as a `SurveyJson` object and registered as an activity in the session:

```ts
// future: survey activity alongside cognitive games
import { Survey } from "@m2c2kit/survey";
const survey = new Survey(surveyJson);
const session = new Session({ activities: [colorDots, survey] });
```

### Questionnaire parameters to add to `AssessmentConfig`

When surveys are implemented, the following parameters will be supported:

| Parameter         | Type    | Description                                                                 |
| ----------------- | ------- | --------------------------------------------------------------------------- |
| `activity_id`     | string  | e.g. `"mood-survey"` — must match a registered survey id                    |
| `question_ids`    | array   | Subset of questions to show at this prompt (allows adaptive/rotating items) |
| `randomize_order` | boolean | Randomize item order within the questionnaire                               |
| `show_progress`   | boolean | Show a progress bar during the survey                                       |

### Example surveys to implement

| Survey name       | Purpose                            | Validated scale  |
| ----------------- | ---------------------------------- | ---------------- |
| Momentary affect  | Positive/negative affect right now | PANAS items      |
| Stress/anxiety    | Perceived stress at this moment    | PSS-4 adapted    |
| Sleep quality     | Sleep quality from last night      | PSQI single-item |
| Physical activity | Activity in past hour              | Custom           |
| Social context    | Alone vs. with others              | Custom           |

---

## 4. Scheduling

Controlled by the `schedule` field of `StudyProtocol`:

| Parameter                 | Type    | Description                                                                           |
| ------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `windows`                 | array   | Time windows during which prompts may fire, e.g. `[{ start: "09:00", end: "21:00" }]` |
| `prompts_per_day`         | integer | How many prompts per day total                                                        |
| `min_gap_minutes`         | integer | Minimum minutes between consecutive prompts                                           |
| `randomize_within_window` | boolean | Randomize exact prompt time within each sub-window                                    |
| `expiry_minutes`          | integer | How many minutes after delivery before a prompt is marked expired                     |
| `days_total`              | integer | Total study duration in days                                                          |

**Typical EMA schedule:**

```json
"schedule": {
  "windows": [{ "start": "09:00", "end": "21:00" }],
  "prompts_per_day": 4,
  "min_gap_minutes": 60,
  "randomize_within_window": true,
  "expiry_minutes": 30,
  "days_total": 14
}
```

---

## 5. First-Session Instructions

The `show_instructions` parameter should be `true` only on the first prompt of a study and `false` for all subsequent prompts. The backend and/or scheduler should set this based on whether the participant has completed at least one session before:

```json
// First prompt of the study
{ "show_instructions": true, "number_of_trials": 3 }

// All subsequent prompts
{ "show_instructions": false, "number_of_trials": 3 }
```

This logic will be implemented in the Setup UI (Agent 06) at enrollment time and stored in the participant's protocol on the backend.

---

## 6. Full Example Protocol

```json
{
  "study_id": "my-ema-study",
  "study_uuid": "<uuid>",
  "version": 1,
  "schedule": {
    "windows": [{ "start": "09:00", "end": "21:00" }],
    "prompts_per_day": 4,
    "min_gap_minutes": 60,
    "randomize_within_window": true,
    "expiry_minutes": 30,
    "days_total": 14
  },
  "assessments": [
    {
      "activity_id": "color-dots",
      "activity_version": "0.8.34",
      "selection_strategy": "round_robin",
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
      "selection_strategy": "round_robin",
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
      "selection_strategy": "round_robin",
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
      "selection_strategy": "round_robin",
      "order": 3,
      "parameters": {
        "number_of_trials": 3,
        "scoring": true,
        "show_instructions": false
      }
    }
  ],
  "context_collection": {
    "gps_on_prompt": true,
    "gps_interval_minutes": null,
    "collect_battery": true,
    "collect_network_type": true
  }
}
```
