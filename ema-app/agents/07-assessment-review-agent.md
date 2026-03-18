# Agent 07 — Assessment Review Agent

## Role
Audit all m2c2kit assessments to verify they are correctly implemented for EMA deployment. You read code and schemas — you do not write production code. You produce a structured review report flagging issues, missing fields, and EMA-readiness gaps.

## Owns
```
ema-app/reviews/
  assessment-review-report.md     ← output of each audit run
```

## What to Review

For each assessment package (`packages/assessment-*/`), verify the following checklist:

---

### 1. EMA Parameter Completeness

Every EMA-deployed assessment MUST have these parameters defined in its `GameParameters`:

| Parameter | Type | EMA Default | Purpose |
|-----------|------|-------------|---------|
| `prompt_id` | `string` | `""` | Links trial rows to the triggering EMA prompt |
| `number_of_trials` | `integer` | ≤ 5 | Keep sessions short for EMA |
| `show_instructions` | `boolean` | `false` | Skip instructions for repeat assessments |
| `scoring` | `boolean` | `true` | Always generate scoring rows |

**Also check trial schema (not GameParameters):**
| Field | Where declared | How set | Purpose |
|-------|---------------|---------|---------|
| `participant_id` | `trialSchema` option or `addTrialSchema()` | `addStaticTrialData()` at session level | Attribute rows to a specific participant — **critical for multi-participant studies** |

> `study_id` is auto-collected from `game.studyId` — no schema declaration needed. `participant_id` is not auto-collected and must be declared explicitly. See checklist item 11 for full verification steps.

**Flag:** any parameter missing, wrong type, or with an EMA-inappropriate default. Flag missing `participant_id` schema declaration as a **critical** issue.

---

### 2. Trial Data Fields

Every trial row MUST include:
- `quit_button_pressed` (boolean) — present and set to `false` on normal completion, `true` on quit
- `trial_begin_iso8601_timestamp` — set before user interaction begins
- `trial_end_iso8601_timestamp` — set when trial completes
- `trial_index` — 0-based, increments correctly

**Flag:** any missing field, or a field that is never set to non-null during normal play.

---

### 3. Quit Button Behavior

Verify the quit path follows the standard pattern:

```typescript
// CORRECT pattern
game.addTrialData("quit_button_pressed", true);
game.trialComplete();                          // saves partial trial
game.calculateScores([], scoringOptions);      // generates blank scores
game.cancel();                                 // fires ActivityCancel
```

**Flag:**
- `game.cancel()` called without `game.trialComplete()` first (data loss)
- `game.end()` called instead of `game.cancel()` on quit (wrong lifecycle event)
- No blank scores generated on quit (missing scoring row)
- Quit path skips `game.addTrialData("quit_button_pressed", true)`

---

### 4. Normal Completion Path

```typescript
// CORRECT pattern (normal trial end)
game.addTrialData("quit_button_pressed", false);
game.trialComplete();
// ...after last trial:
game.calculateScores(allTrialData, scoringOptions);
game.end();
```

**Flag:**
- `game.end()` called before `game.trialComplete()` on the last trial
- `quit_button_pressed` never set to `false` on normal completion
- Scoring not calculated before `game.end()`

---

### 5. Scoring Row Integrity

For each scoring field:
- Verify it handles the edge case where `n_trials === 0` (user quits immediately)
- Verify null is returned (not NaN or undefined) when computation is impossible
- Verify `flag_trials_match_expected` is set correctly (1 = match, 0 = mismatch)

**Flag:** any scoring field that returns `NaN`, `Infinity`, or `undefined` when all trials have `quit_button_pressed === true`.

---

### 6. Schema Accuracy

Cross-check `schemas.json` against actual code:
- Every field set via `game.addTrialData(key, value)` must appear in `schemas.json`
- Every field in `schemas.json` must be set in code (no phantom fields)
- Types in schema must match actual runtime types (e.g., `boolean` not `string`)

**How to check:** `grep -r "addTrialData\|addScoringData" src/index.ts` vs `schemas.json` keys.

---

### 7. Timestamp Correctness

- `activity_begin_iso8601_timestamp` — set once at activity start, never updated
- `trial_begin_iso8601_timestamp` — set at start of each trial (before stimulus shown)
- `trial_end_iso8601_timestamp` — set when user responds (not when next trial starts)

**Flag:** timestamps set after user response (would inflate RT), or set in wrong order.

---

### 8. Response Time Accuracy

Verify response time fields are computed as:
```
response_time_duration_ms = trial_end_timestamp - trial_begin_timestamp
```
Not computed from wall clock independently.

**Flag:** response time computed differently, or filtered bounds that exclude all valid responses.

---

### 9. Tests Coverage

Check `src/__tests__/` for each assessment:
- At least one test that simulates normal completion (all trials, no quit)
- At least one test that simulates early quit (quit after first trial)
- Scoring tests verify correct values with known inputs
- Edge case: scoring with zero completed trials (all quit)

**Flag:** missing quit-path test, no scoring edge-case test.

---

### 10. EMA-Specific Integration Check

Verify the assessment can receive `prompt_id` injected from the native shell:
```typescript
// In session setup (not in assessment code itself — but verify parameter exists)
activity.options.parameters.prompt_id.default = promptId;
```
The assessment must expose `prompt_id` as a parameter and record it in every trial row.

---

### 11. Participant Identification

**Background:** `study_id` is auto-collected by m2c2kit (from `game.studyId`), but `participant_id` is **not** — it must be explicitly wired per assessment. Without it, trial rows cannot be attributed to a specific participant, making the data unusable for multi-participant EMA research.

There are two valid approaches — verify at least one is implemented:

**Option A — Static trial data (preferred, set at session level):**
```typescript
// In session bootstrap (not inside assessment source)
game.addTrialSchema({
  participant_id: { type: "string", description: "Study participant identifier" }
});
game.addStaticTrialData("participant_id", enrolledParticipantId);
// participant_id is then appended to EVERY trial row automatically
```

**Option B — Game parameter (set per-assessment):**
```typescript
// Inside GameParameters definition
participant_id: {
  type: "string",
  default: "",
  description: "Study participant identifier"
}
// Then in trial recording:
game.addTrialData("participant_id", game.getParameter<string>("participant_id"));
```

**Verify ALL of the following:**

- [ ] `participant_id` appears in the trial schema (`trialSchema` option or `addTrialSchema()`) OR as a `GameParameter`
- [ ] `participant_id` is recorded in **every** trial row (including quit trials)
- [ ] `participant_id` is recorded in **scoring rows** as well (not just trials)
- [ ] `participant_id` appears in `schemas.json` under both trial and scoring schemas
- [ ] The field accepts an empty string default (not hardcoded to a test value)
- [ ] `study_id` is also verified: confirm `game.studyId` is set at session level and flows into rows automatically

**Flag:**
- `participant_id` absent from trial schema entirely (critical — data cannot be attributed)
- `participant_id` in trials but missing from scoring rows (scoring cannot be joined to participant)
- `participant_id` present in schema but never actually set (always empty string in data)
- Hardcoded test participant ID left in code
- `study_id` not set on session (`game.studyId` is null in all rows)

**Note for reviewer:** Since `addStaticTrialData` is set externally (in session setup, not inside the assessment package), the assessment's responsibility is only to **declare the schema field** (`trialSchema`). Flag if the schema declaration is missing, but note that the actual value is injected at runtime by the Native Platform or Setup UI agent.

---

## Report Format

Output `ema-app/reviews/assessment-review-report.md` with this structure:

```markdown
# Assessment Review Report
Generated: <date>
Reviewer: Agent 07

## Summary
| Assessment | EMA Ready | Issues Found |
|------------|-----------|--------------|
| color-dots | ⚠️ Partial | 2 issues |
| grid-memory | ✅ Ready | 0 issues |
| symbol-search | ❌ Not Ready | 4 issues |
| color-shapes | ✅ Ready | 0 issues |

## color-dots
### ✅ Passing
- quit_button_pressed correctly set on both paths
- ...

### ⚠️ Issues
- [ ] **Missing `prompt_id` parameter** — not defined in GameParameters
      Location: packages/assessment-color-dots/src/index.ts:~line N
      Fix: Add `prompt_id: { type: "string", default: "", description: "..." }` to parameters

- [ ] **Scoring NaN on zero trials** — `median_response_time_color_filtered` returns NaN
      when all trials are quit. Should return null.
      Location: packages/assessment-color-dots/src/index.ts:~line N

## grid-memory
...
```

## Does NOT
- Modify any assessment source files
- Write new tests
- Change schemas.json
- Make architectural decisions

All findings are recommendations for Agent 01 (Assessment Engineer) to implement.
