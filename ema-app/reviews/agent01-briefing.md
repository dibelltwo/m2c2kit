# Agent 01 Briefing — EMA Assessment Fixes

**Source:** Assessment Review Report (Agent 07, 2026-03-18)
**Full report:** `ema-app/reviews/assessment-review-report.md`

---

## Context

All four m2c2kit assessments need changes to be EMA-ready. The fixes fall into two categories:

1. **EMA parameter additions** — new `GameParameters` and trial schema fields needed by the EMA shell
2. **Bug fixes** — one runtime crash, one schema type inconsistency

`study_id` is **already** auto-collected by m2c2kit — do not add it.
`participant_id` is **not** auto-collected — it must be declared in each assessment's `trialSchema` so the session bootstrap can call `game.addStaticTrialData("participant_id", value)` at runtime.

---

## Fix Order (execute in this sequence)

### Priority 1 — Bug Fix (runtime crash)

**File:** `packages/assessment-symbol-search/src/index.ts:1327`

```typescript
// WRONG — parameter does not exist under this name
game.getParameter("interstimulus_interval_ms")

// CORRECT — matches the parameter declaration at line 101
game.getParameter("interstimulus_interval_duration_ms")
```

---

### Priority 2 — Add `participant_id` to trial schema (CRITICAL, all 4)

Each assessment declares its trial schema as a `const` object near the top of `index.ts`. Add the `participant_id` field to each.

| Assessment | Schema object name | Location |
|------------|-------------------|----------|
| color-dots | `colorDotsTrialSchema` | lines 187–315 |
| grid-memory | `gridMemoryTrialSchema` | lines 154–317 |
| symbol-search | `symbolSearchTrialSchema` | lines 169–263 |
| color-shapes | `colorShapesTrialSchema` | lines 189–311 |

**Add this field to each schema object:**
```typescript
participant_id: {
  type: "string",
  description: "Study participant identifier, set at session level via addStaticTrialData.",
},
```

> Do NOT add `participant_id` to `defaultParameters` (it is not a game parameter — it is injected externally). Do NOT call `game.addTrialData("participant_id", ...)` inside the assessment — the session bootstrap handles that via `addStaticTrialData`.

---

### Priority 3 — Add `prompt_id` parameter (all 4)

Add to both the `defaultParameters` object AND the trial schema of each assessment.

**In `defaultParameters`:**
```typescript
prompt_id: {
  type: "string",
  default: "",
  description: "EMA prompt UUID that triggered this session. Set by the EMA shell at session start.",
},
```

**In the trial schema:**
```typescript
prompt_id: {
  type: "string",
  description: "EMA prompt UUID that triggered this session.",
},
```

**In the trial recording block** (where other `game.addTrialData(...)` calls are made, on the normal completion path AND the quit path):
```typescript
game.addTrialData("prompt_id", game.getParameter<string>("prompt_id"));
```

Locations to add the `addTrialData` call:

| Assessment | Normal path line | Quit path line |
|------------|-----------------|----------------|
| color-dots | ~1342 (near other addTrialData calls) | ~598 (quit handler) |
| grid-memory | ~1324 (near other addTrialData calls) | ~696 (quit handler) |
| symbol-search | ~1316 (near other addTrialData calls) | ~772 (quit handler) |
| color-shapes | ~1269 (near other addTrialData calls) | ~725 (quit handler) |

---

### Priority 4 — Add `show_instructions` parameter (all 4)

**In `defaultParameters`:**
```typescript
show_instructions: {
  type: "boolean",
  default: false,
  description: "Show instructions before the assessment. Default false for EMA repeat sessions.",
},
```

**Gate the instructions scenes** on this parameter. Each assessment has an instructions scene array (e.g., `instructionsScenes`). Wrap the scene addition in a condition:

```typescript
if (game.getParameter<boolean>("show_instructions")) {
  instructionsScenes.forEach((scene) => game.addScene(scene));
  game.presentScene(instructionsScenes[0]);
} else {
  game.presentScene(firstTrialScene);
}
```

> Check the existing flow for each assessment — the entry point after instructions varies. Do not break the existing flow when `show_instructions === true`.

---

### Priority 5 — Change `scoring` default to `true` (all 4)

| Assessment | Location |
|------------|----------|
| color-dots | line 165–169 |
| grid-memory | line 135–139 |
| symbol-search | line 141–145 |
| color-shapes | line 167–171 |

Change:
```typescript
default: false,
```
To:
```typescript
default: true,
```

---

### Priority 6 — Lower `number_of_trials` defaults (2 assessments)

| Assessment | Current default | Change to | Location |
|------------|----------------|-----------|----------|
| symbol-search | 20 | 5 | line 91–95 |
| color-shapes | 12 | 5 | line 122–126 |

color-dots (default 5) and grid-memory (default 4) are already within EMA limits — do not change.

---

### Priority 7 — Fix minor schema type inconsistency (color-shapes only)

**File:** `packages/assessment-color-shapes/src/index.ts:550–554`

```typescript
// WRONG — null type is spurious; this field is always an integer
n_outliers_rt_CR_valid: {
  type: ["number", "null"],
  ...
}

// CORRECT — matches runtime behavior and parallel fields (HIT/MISS/FA)
n_outliers_rt_CR_valid: {
  type: "number",
  ...
}
```

---

### Priority 8 — Generate `schemas.json` (all 4, do last)

After all code changes are made, run in each package:

```bash
npm run build -w @m2c2kit/assessment-color-dots
npm run build -w @m2c2kit/assessment-grid-memory
npm run build -w @m2c2kit/assessment-symbol-search
npm run build -w @m2c2kit/assessment-color-shapes
```

Then generate schemas (if `npm run schemas` exists in each package):
```bash
npm run schemas -w @m2c2kit/assessment-color-dots
npm run schemas -w @m2c2kit/assessment-grid-memory
npm run schemas -w @m2c2kit/assessment-symbol-search
npm run schemas -w @m2c2kit/assessment-color-shapes
```

Verify `schemas.json` is created and contains `participant_id` and `prompt_id` in the trial schema section.

---

## What NOT to Change

- Do not modify scoring logic — it passes all tests and handles edge cases correctly
- Do not modify quit path sequencing — it is correct in all four assessments
- Do not modify timestamp logic — it is correct in all four
- Do not modify response time calculations — all use `Timer`, not wall clock
- Do not add `study_id` to any schema — it is auto-collected by the engine
- Do not add `participant_id` to `defaultParameters` — it is not a game parameter

---

## Verification Checklist (run after all changes)

- [ ] `npm run test -w @m2c2kit/assessment-color-dots` passes
- [ ] `npm run test -w @m2c2kit/assessment-grid-memory` passes
- [ ] `npm run test -w @m2c2kit/assessment-symbol-search` passes
- [ ] `npm run test -w @m2c2kit/assessment-color-shapes` passes
- [ ] `schemas.json` exists in all four packages
- [ ] `schemas.json` contains `participant_id` in trial schema
- [ ] `schemas.json` contains `prompt_id` in trial schema
- [ ] Symbol-search: `interstimulus_interval_duration_ms` (not `_ms`) at line 1327
