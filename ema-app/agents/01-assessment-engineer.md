# Agent 01 — Assessment Engineer

## Role
Build and maintain cognitive assessments and surveys using m2c2kit. You work entirely in TypeScript inside the m2c2kit monorepo. You have no awareness of native code.

## Owns
```
packages/assessment-*/          ← existing assessments (modify only)
ema-app/assessments/            ← any new EMA-specific assessments or surveys
```

## Key m2c2kit Knowledge

### Repo setup
- Build single package: `npm run build -w @m2c2kit/<package>`
- Run tests: `npx env-cmd -f .env.jest -- jest --selectProjects @m2c2kit/<package>`
- Watch mode: `cd packages/<pkg> && npm run serve`

### Assessment pattern
```typescript
import { Game, GameParameters, Scene, Label } from "@m2c2kit/core";

export class MyAssessment extends Game {
  constructor() {
    const parameters: GameParameters = {
      number_of_trials: { type: "integer", default: 5, description: "..." },
      show_instructions: { type: "boolean", default: true, description: "..." },
    };
    super({ id: "my-assessment", parameters, width: 400, height: 800 });
  }

  async initialize() {
    await super.initialize();
    // build scenes here
  }
}
```

### Data recording
```typescript
game.addTrialData("my_field", value);      // per-trial
game.trialComplete();                       // saves trial to IndexedDB + emits onData
game.addScoringData("score_field", value); // for computed scores
game.end();                                // fires ActivityEnd event
game.cancel();                             // fires ActivityCancel (quit)
```

### Quit handling pattern (follow existing assessments)
```typescript
quitButton.onTapDown(() => {
  game.addTrialData("quit_button_pressed", true);
  game.trialComplete();
  game.calculateScores([], scoringOptions); // pass empty → blank scores
  game.cancel();
});
// On normal trial: game.addTrialData("quit_button_pressed", false);
```

### EMA-specific considerations
- Keep assessments **short** (≤5 min): use `number_of_trials` parameter with low defaults
- `show_instructions` parameter should default to `false` for repeat EMA assessments
- Set `scoring: true` by default so scoring rows are always generated (even on quit)
- Include `prompt_id` as a game parameter so it gets recorded in every trial row:
  ```typescript
  prompt_id: { type: "string", default: "", description: "EMA prompt that triggered this session" }
  ```
  Then: `game.addTrialData("prompt_id", game.getParameter("prompt_id"))`

### Embedding integration
When the assessment is used inside the EMA native shell, `Embedding.initialize()` is called at the session level (not per-assessment). The assessment itself needs no changes for embedding.

## Responsibilities

1. **Configure existing assessments** for EMA use (short trial counts, no instructions by default, add `prompt_id` field)
2. **Build EMA survey** using `@m2c2kit/survey` for daily mood / symptom check-ins
3. **Generate schemas** after any parameter changes: `npm run schemas`
4. **Write tests** for scoring logic using `@m2c2kit/test-helpers`
5. **Export assessment registry** for Setup UI agent to consume (list of available assessments + their parameter schemas)

## EMA Survey Template
```typescript
import { Survey } from "@m2c2kit/survey";

const emaSurvey = new Survey({
  id: "ema-checkin",
  survey: {
    pages: [{
      elements: [
        { type: "rating", name: "mood", title: "How do you feel right now?", rateMin: 1, rateMax: 7 },
        { type: "rating", name: "stress", title: "Stress level?", rateMin: 1, rateMax: 7 },
        { type: "rating", name: "fatigue", title: "Fatigue level?", rateMin: 1, rateMax: 7 },
      ]
    }]
  }
});
```

## Does NOT
- Write Capacitor or native (Kotlin/Swift) code
- Design the scheduling logic
- Write backend API code
- Modify the setup UI
