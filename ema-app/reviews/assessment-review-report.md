# Assessment Review Report
Generated: 2026-03-17
Reviewer: Agent 07

---

## Summary

| Assessment | EMA Ready | Issues Found |
|------------|-----------|--------------|
| color-dots | ⚠️ Partial | 4 issues |
| grid-memory | ⚠️ Partial | 3 issues |
| symbol-search | ⚠️ Partial | 6 issues |
| color-shapes | ⚠️ Partial | 4 issues |

**Note on `schemas.json`:** The agent instructions assume standalone `schemas.json` files at `packages/assessment-*/schemas.json`. These files do not exist in any of the four packages. All schema definitions are embedded in `src/index.ts` as TypeScript `TrialSchema` and `ScoringSchema` objects. The schema accuracy check (checklist item 6) was performed against those embedded objects.

**Common gap across all four assessments:** `prompt_id` and `show_instructions` parameters are absent from every assessment. `scoring` defaults to `false` in all four.

---

## color-dots

### Passing

- `quit_button_pressed` is set to `true` on the quit path (line 598) and `false` on normal completion (line 1342). Both paths covered.
- Quit path follows the correct pattern: `addTrialData("quit_button_pressed", true)` → `trialComplete()` → `calculateScores([], ...)` → `addScoringData()` → `scoringComplete()` → `cancel()` (lines 598–617). No data loss. `cancel()` (not `end()`) fires the ActivityCancel lifecycle event correctly.
- Normal completion: `addTrialData("quit_button_pressed", false)` → `trialComplete()` → `calculateScores(game.data.trials, ...)` → `addScoringData()` → `scoringComplete()` → `end()` (lines 1342–1399). Correct.
- `trial_begin_iso8601_timestamp` is set in `fixationScene.onAppear()` (line 867), before any stimulus is shown. Correct ordering.
- `trial_end_iso8601_timestamp` is set in `locationSelectionDoneButton.onTapDown()` (lines 1326–1329), at the moment of user response. Correct ordering.
- Color response time: `Timer.startNew("colorRt")` in `colorSelectionScene.onAppear()` (line 1062), `Timer.elapsed("colorRt")` on done button press (line 981). Correct — timer bounds match user interaction window.
- Location response time: `Timer.startNew("locationRt")` in `locationSelectionScene.onAppear()` (line 1310), `Timer.elapsed("locationRt")` on done button press (line 1323). Correct.
- `trial_index` is set as `game.trialIndex` on normal completion (line 1343).
- `activity_begin_iso8601_timestamp` is drawn from `this.beginIso8601Timestamp` (lines 863–864), set once at activity start. Correct — not re-sampled per trial.
- Scoring row integrity: `median()` and `sum()` from the `data-calc` library return `null` on empty arrays (confirmed by `data-calc` unit tests). On the quit-without-any-trials path where `calculateScores([])` is called, all computed fields produce `null`. No NaN or Infinity exposure.
- `flag_trials_match_expected` correctly set as `n_trials === extras.numberOfTrials ? 1 : 0` (line 1526).
- `number_of_trials` defaults to `5` — within EMA guideline (≤ 5). ✓
- Schema cross-check: all fields set via `addTrialData` in the normal path are declared in `colorDotsTrialSchema`. No phantom fields detected.
- Test data covers: 5-trial all-correct session, 5-trial mixed swap/random session, partial-quit session (quit after 2 trials), and quit-without-any-trials session (line 792 in `data.ts`). The `for (const trials of data)` loop in `scoring.test.ts` exercises `calculateScores` for all four datasets including the zero-valid-trials edge case.

### Issues

- [ ] **Missing `prompt_id` parameter** — `prompt_id` is not defined in `defaultParameters` (lines 57–179) and is not in `colorDotsTrialSchema`. The EMA shell cannot inject the triggering prompt ID, and trial rows cannot be linked to an EMA prompt.
      Location: `packages/assessment-color-dots/src/index.ts:57`
      Fix: Add `prompt_id: { type: "string", default: "", description: "Links trial rows to the triggering EMA prompt." }` to `defaultParameters`; add `prompt_id: { type: "string", description: "..." }` to `colorDotsTrialSchema`; call `game.addTrialData("prompt_id", game.getParameter("prompt_id"))` in the trial data-recording block.

- [ ] **Missing `show_instructions` parameter** — No `show_instructions` boolean exists. EMA repeat assessments cannot suppress instructions for returning participants.
      Location: `packages/assessment-color-dots/src/index.ts:57`
      Fix: Add `show_instructions: { type: "boolean", default: false, description: "Skip instructions for repeat EMA sessions." }` to `defaultParameters` and gate the instructions scenes on this parameter value.

- [ ] **`scoring` parameter defaults to `false`** — EMA deployment requires scoring rows on every session. The default of `false` means scoring is silently omitted unless the EMA harness explicitly overrides it.
      Location: `packages/assessment-color-dots/src/index.ts:167`
      Fix: Change `default: false` to `default: true` for the `scoring` parameter, or document that the EMA harness must always set `scoring: true`.

- [ ] **No game-lifecycle integration tests** — `scoring.test.ts` only exercises `calculateScores()` in isolation with static data. There is no test that simulates the quit-button tap path (`quitSprite.onTapDown` callback at line 592), verifying that `trialComplete()` precedes `cancel()`, that scoring fires correctly, or that normal completion produces the correct `game.end()` call.
      Location: `packages/assessment-color-dots/src/__tests__/scoring.test.ts`
      Fix: Add integration tests using the m2c2kit test runner simulating: (a) a full normal session, (b) a quit after the first trial.

---

## grid-memory

### Passing

- `quit_button_pressed` is set to `true` on quit (line 696) and `false` on normal completion (line 1324). Both paths covered.
- Quit path: `addTrialData("quit_button_pressed", true)` → `trialComplete()` → `calculateScores([], ...)` → `addScoringData()` → `scoringComplete()` → `cancel()` (lines 696–709). Correct pattern.
- Normal completion: last-trial detection via `game.trialIndex === game.getParameter("number_of_trials")` (line 1327) — note: uses strict equality (not `<`), which is correct because `trialIndex` has already been incremented by `trialComplete()`. Then: `calculateScores(game.data.trials, ...)` → `addScoringData()` → `scoringComplete()` → `end()` (lines 1326–1373). Correct.
- `trial_begin_iso8601_timestamp` is set in `preparationScene.onAppear()` as the first step of an `Action.sequence`, immediately before the preparation wait (lines 827–835). Correct ordering.
- `trial_end_iso8601_timestamp` is set when the recall done button is tapped (lines 1301–1304). Correct.
- `response_time_duration_ms` is measured by `Timer.elapsed("responseTime")` (line 1298, timer stopped before `doneButtonElapsedMs` is recorded). Timer starts when the blank recall grid appears. Correct — not recomputed from wall-clock difference.
- `trial_index` is set as `game.trialIndex` on normal completion (line 1325).
- `activity_begin_iso8601_timestamp` drawn from `this.beginIso8601Timestamp`. Correct.
- Scoring zero-trial edge case: `percent_exact_targets` explicitly guards with `obs.n_trials === 0 ? null : ...` (line 1489). `mean()`, `median()`, `min()`, `max()`, `sd()` all return `null` on empty inputs from data-calc. No NaN exposure.
- `flag_trials_match_expected` correctly set (line 1461).
- `number_of_trials` defaults to `4` — within EMA guideline (≤ 5). ✓
- Test data covers: 4-trial session, 4-trial perfect-score session, partial-quit session, quit-without-any-trials session (line 1078 in `data.ts`). Edge cases exercised.

### Issues

- [ ] **Missing `prompt_id` parameter** — Not defined in `defaultParameters` (lines 57–146) or `gridMemoryTrialSchema`.
      Location: `packages/assessment-grid-memory/src/index.ts:57`
      Fix: Add `prompt_id` parameter to `defaultParameters`, add field to `gridMemoryTrialSchema`, and call `game.addTrialData("prompt_id", ...)` per trial.

- [ ] **Missing `show_instructions` parameter** — Not defined anywhere.
      Location: `packages/assessment-grid-memory/src/index.ts:57`
      Fix: Add `show_instructions: { type: "boolean", default: false, ... }` and gate instruction scenes on it.

- [ ] **`scoring` parameter defaults to `false`** — Same issue as in color-dots.
      Location: `packages/assessment-grid-memory/src/index.ts:137`
      Fix: Change `default: false` to `default: true`.

- [ ] **No game-lifecycle integration tests** — Same gap as color-dots. Only `calculateScores()` is tested in isolation.
      Location: `packages/assessment-grid-memory/src/__tests__/scoring.test.ts`
      Fix: Add integration tests for full normal session and early-quit session.

> Cosmetic note (not a bug): `calculateScores` initializes `dc` as `new DataCalc(data).filter(quit_button_pressed === false)` (line 1389), then immediately re-filters on the same predicate at line 1394 to compute `n_trials`. The double-filter is redundant but correct.

---

## symbol-search

### Passing

- `quit_button_pressed` is set to `true` on quit (line 772) and `false` on normal completion (line 1316). Both paths covered.
- Quit path: `addTrialData("quit_button_pressed", true)` → `trialComplete()` → `calculateScores([], ...)` → `addScoringData()` → `scoringComplete()` → `cancel()` (lines 772–790). Correct.
- Normal completion: after last trial, `trialComplete()` → `calculateScores(game.data.trials, ...)` → `addScoringData()` → `scoringComplete()` → `end()` (lines 1318–1357). Correct.
- `trial_begin_iso8601_timestamp` is set in `chooseCardScene.onAppear()` (lines 1368–1371), before user interaction. Correct.
- `trial_end_iso8601_timestamp` is set when a card is tapped (lines 1289–1292), at the moment of user response. Correct.
- `response_time_duration_ms` measured via `Timer.elapsed("rt")` (line 1286). Correct.
- `trial_index` set as `game.trialIndex` (line 1317).
- `activity_begin_iso8601_timestamp` drawn from `this.beginIso8601Timestamp`. Correct.
- Scoring zero-trial edge case: `median()` with `skipMissing: true` returns `null` on empty or all-null inputs. `participant_score` is explicitly guarded: `obs.median_response_time_correct === null ? null : 10000 / obs.median_response_time_correct` (lines 1522–1525). No NaN exposure on zero-trial path.
- `flag_trials_match_expected` correctly set (line 1457).
- `scoring_filter_response_time_duration_ms` default is `[100, 10000]`. Reasonable.
- Test data covers: 20-trial session, outlier-RT session, partial-quit-with-outlier-RT session, quit-without-any-trials session (line 2355 in `data.ts`). Edge cases exercised.

### Issues

- [ ] **[BUG] Wrong parameter name in `interstimulus_animation === false` code path** — The parameter is declared as `interstimulus_interval_duration_ms` (line 101), but is read as `"interstimulus_interval_ms"` at line 1327. When `interstimulus_animation` is `false`, `game.getParameter("interstimulus_interval_ms")` returns `undefined`, making the `Action.wait` duration `undefined`. This silently breaks the inter-trial delay for any study that disables the animation. The default (`interstimulus_animation: true`) masks the bug in normal usage.
      Location: `packages/assessment-symbol-search/src/index.ts:1327`
      Fix: Change `game.getParameter("interstimulus_interval_ms")` to `game.getParameter("interstimulus_interval_duration_ms")`.

- [ ] **Missing `prompt_id` parameter** — Not defined in `defaultParameters` (lines 46–161) or `symbolSearchTrialSchema`.
      Location: `packages/assessment-symbol-search/src/index.ts:46`
      Fix: Add `prompt_id` parameter to `defaultParameters`, add field to `symbolSearchTrialSchema`, and call `game.addTrialData("prompt_id", ...)` in `chooseCardScene.onAppear()` alongside the existing trial data.

- [ ] **Missing `show_instructions` parameter** — Not defined anywhere.
      Location: `packages/assessment-symbol-search/src/index.ts:46`
      Fix: Add `show_instructions: { type: "boolean", default: false, ... }` and gate instruction scenes on it.

- [ ] **`scoring` parameter defaults to `false`** — Same issue as other assessments.
      Location: `packages/assessment-symbol-search/src/index.ts:143`
      Fix: Change `default: false` to `default: true`.

- [ ] **`number_of_trials` default is `20` — exceeds EMA guideline of ≤ 5** — A session of 20 trials is inappropriate for EMA use. The EMA shell must explicitly override this every time, creating a fragile dependency on correct configuration.
      Location: `packages/assessment-symbol-search/src/index.ts:92`
      Fix: Either lower the default to a value ≤ 5 (e.g., `5`), or prominently document that the EMA session builder must always set `number_of_trials` to ≤ 5 for this assessment.

- [ ] **No game-lifecycle integration tests** — Same gap as other assessments. Notably, the `interstimulus_interval_ms` bug at line 1327 would be caught by a test that exercises the `interstimulus_animation === false` code path.
      Location: `packages/assessment-symbol-search/src/__tests__/scoring.test.ts`
      Fix: Add integration tests for full normal session and early-quit session; include a case with `interstimulus_animation: false`.

---

## color-shapes

### Passing

- `quit_button_pressed` is set to `true` on quit (line 725) and `false` on normal completion (line 1269). Both paths covered.
- Quit path: `addTrialData("quit_button_pressed", true)` → `trialComplete()` → `calculateScores([], ...)` → `addScoringData()` → `scoringComplete()` → `cancel()` (lines 725–743). Correct.
- Normal completion: `addTrialData("quit_button_pressed", false)` → `trialComplete()` → `calculateScores(game.data.trials, ...)` → `addScoringData()` → `scoringComplete()` → `end()` (lines 1269–1310). Correct.
- `trial_begin_iso8601_timestamp` is set in `fixationScene.onAppear()` (lines 1088–1091), before stimulus presentation. Correct.
- `trial_end_iso8601_timestamp` is set when the Same/Different button is tapped (lines 1243–1246). Correct — at moment of response.
- `response_time_duration_ms` measured via `Timer.elapsed("rt")` (line 1239). Correct.
- `trial_index` set as `game.trialIndex` (line 1280).
- `activity_begin_iso8601_timestamp` drawn from `this.beginIso8601Timestamp`. Correct.
- Scoring zero-trial edge case: `HIT_rate`, `MISS_rate`, `FA_rate`, `CR_rate` all guard against division by zero, returning `null` when denominator is 0 (lines 1422–1448). `participant_score` returns `null` when `d.length === 0` (line 1651). `median()` and `sd()` return `null` on empty arrays. No NaN exposure.
- `flag_trials_match_expected` correctly set (line 1395).
- `scoring_filter_response_time_duration_ms` default is `[100, 10000]`. Reasonable.
- `number_of_trials` defaults to `12`. This exceeds the EMA guideline of ≤ 5 (see issue below).
- Test data covers: 12-trial session, session with RT outliers, 1-trial-then-quit session, quit-without-any-trials session (line 2005 in `data.ts`). Edge cases exercised.
- Schema cross-check: all `addTrialData` keys appear in `colorShapesTrialSchema`; all scoring fields appear in `colorShapesScoringSchema`. No phantom fields detected.
- Minor: `calculateScores` does not pre-filter quit rows before calling `.mutate()`. Quit rows receive `metric_accuracy: null` and `is_valid: false` from the mutate, which correctly excludes them from all downstream aggregations. This works correctly in the current implementation.

### Issues

- [ ] **Missing `prompt_id` parameter** — Not defined in `defaultParameters` (lines 55–181) or `colorShapesTrialSchema`.
      Location: `packages/assessment-color-shapes/src/index.ts:55`
      Fix: Add `prompt_id` parameter to `defaultParameters`, add to `colorShapesTrialSchema`, and record via `game.addTrialData("prompt_id", ...)` in the response-recording block (after `Timer.stop("rt")`, approximately line 1248).

- [ ] **Missing `show_instructions` parameter** — Not defined anywhere.
      Location: `packages/assessment-color-shapes/src/index.ts:55`
      Fix: Add `show_instructions: { type: "boolean", default: false, ... }` and gate instruction scenes on it.

- [ ] **`scoring` parameter defaults to `false`** — Same issue as other assessments.
      Location: `packages/assessment-color-shapes/src/index.ts:169`
      Fix: Change `default: false` to `default: true`.

- [ ] **`number_of_trials` default is `12` — exceeds EMA guideline of ≤ 5** — A default of 12 trials makes EMA sessions too long.
      Location: `packages/assessment-color-shapes/src/index.ts:123`
      Fix: Either lower the default to ≤ 5, or document that the EMA session builder must always override this parameter.

- [ ] **No game-lifecycle integration tests** — Same gap as other assessments. The quit-button handler and game lifecycle sequencing are not tested end-to-end.
      Location: `packages/assessment-color-shapes/src/__tests__/scoring.test.ts`
      Fix: Add integration tests for full normal session and early-quit session.

> Minor schema inconsistency (not a functional bug): In `colorShapesScoringSchema`, `n_outliers_rt_CR_valid` is typed `["number", "null"]` (line 551) while the parallel fields `n_outliers_rt_HIT_valid`, `n_outliers_rt_MISS_valid`, and `n_outliers_rt_FA_valid` are typed `"number"` (lines 505, 520, 535). The runtime value is always a non-null integer (it is a `.length` result). The nullable type union for the CR outlier count is spurious and should be corrected to `"number"` for consistency.

---

## Cross-Assessment Summary

### schemas.json Is Absent in All Four Packages

`packages/assessment-color-dots/schemas.json`, `packages/assessment-grid-memory/schemas.json`, `packages/assessment-symbol-search/schemas.json`, and `packages/assessment-color-shapes/schemas.json` do not exist. The schema accuracy check (checklist item 6) was performed by cross-referencing all `game.addTrialData(key, ...)` and `game.addScoringData(...)` calls in `src/index.ts` against the embedded `TrialSchema` and `ScoringSchema` objects. No discrepancies were found in the schemas that do exist.

If external tooling (e.g., data pipeline, documentation generators) depends on `schemas.json`, these files must be generated from the TypeScript schema objects.

### EMA Parameter Matrix

| Parameter | color-dots | grid-memory | symbol-search | color-shapes |
|-----------|------------|-------------|---------------|--------------|
| `prompt_id` | **Missing** | **Missing** | **Missing** | **Missing** |
| `show_instructions` | **Missing** | **Missing** | **Missing** | **Missing** |
| `number_of_trials` default | 5 (OK) | 4 (OK) | **20 (too high)** | **12 (too high)** |
| `scoring` default | **false** | **false** | **false** | **false** |

### Test Coverage Matrix

| Test Scenario | color-dots | grid-memory | symbol-search | color-shapes |
|--------------|------------|-------------|---------------|--------------|
| Normal completion (scoring calc) | ✓ | ✓ | ✓ | ✓ |
| Partial quit (scoring calc) | ✓ | ✓ | ✓ | ✓ |
| Quit with zero trials (scoring calc) | ✓ | ✓ | ✓ | ✓ |
| Normal completion (lifecycle) | **Missing** | **Missing** | **Missing** | **Missing** |
| Quit-button press (lifecycle) | **Missing** | **Missing** | **Missing** | **Missing** |

### Recommended Fix Priority

1. **CRITICAL — `prompt_id` parameter (all 4 assessments)** — EMA integration blocker. Trial rows cannot be linked to EMA prompts without this field.
2. **HIGH — `interstimulus_interval_ms` typo in symbol-search (line 1327)** — Silent runtime bug that breaks inter-trial timing when animation is disabled.
3. **HIGH — `scoring` default to `true` (all 4 assessments)** — Without this, EMA deployments silently produce no scoring rows unless explicitly configured.
4. **MEDIUM — `show_instructions` parameter (all 4 assessments)** — EMA UX improvement; reduces friction for repeat participants.
5. **MEDIUM — `number_of_trials` default for symbol-search and color-shapes** — Sessions of 20 and 12 trials respectively are too long for EMA. Either lower defaults or mandate session-builder overrides.
6. **LOW — Game-lifecycle integration tests (all 4 assessments)** — Prevents regression in quit-button wiring, `cancel()` vs `end()` semantics, and parameter name bugs.
7. **LOW — `schemas.json` generation** — Required if external tooling depends on these files.

All findings are recommendations for Agent 01 (Assessment Engineer) to implement.
