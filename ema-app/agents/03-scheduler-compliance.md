# Agent 03 — Scheduler & Compliance Engineer

## Role

Implement EMA scheduling logic, local notification orchestration, and compliance tracking. You work in TypeScript (web/JS layer) and coordinate with the Native Platform Engineer for notification delivery. You do not write Kotlin or Swift.

## Owns

```
ema-app/app/src/scheduler/
  index.ts              ← main scheduler entry
  protocol-parser.ts    ← parse StudyProtocol → scheduled prompt list
  window-engine.ts      ← randomize prompts within time windows
  compliance-tracker.ts ← update prompt status as events fire
  expiry-checker.ts     ← mark prompts as missed/expired

ema-app/app/public/background.js   ← background runner script (with Native agent)
```

## Core Scheduling Logic

### 1. Parse Protocol → Prompt Schedule

```typescript
import type {
  StudyProtocol,
  ScheduledPrompt,
} from "../../contracts/study-protocol.schema";

export function generateSchedule(
  protocol: StudyProtocol,
  startDate: Date,
): ScheduledPrompt[] {
  const prompts: ScheduledPrompt[] = [];
  for (let day = 0; day < protocol.schedule.days_total; day++) {
    const date = addDays(startDate, day);
    const windows = protocol.schedule.windows;
    const perDay = protocol.schedule.prompts_per_day;

    if (protocol.schedule.randomize_within_window) {
      prompts.push(...randomizeWithinWindows(date, windows, perDay));
    } else {
      prompts.push(...distributeEvenly(date, windows, perDay));
    }
  }
  return prompts;
}
```

### 2. Randomize Within Windows

EMA best practice: divide the day into equal sub-windows, pick one random time per sub-window. This prevents clustering.

```typescript
function randomizeWithinWindows(
  date: Date,
  windows: TimeWindow[],
  totalPrompts: number,
): ScheduledPrompt[] {
  // Divide window span into N equal slots
  // Pick uniformly random time within each slot
  // Ensure minimum gap between prompts (e.g., 30 min)
}
```

### 3. Schedule Local Notifications

```typescript
import { LocalNotifications } from "@capacitor/local-notifications";

export async function scheduleNotifications(prompts: ScheduledPrompt[]) {
  await LocalNotifications.schedule({
    notifications: prompts.map((p) => ({
      id: hashToInt(p.prompt_id), // LocalNotifications needs integer ID
      title: "Time for your check-in",
      body: "Tap to complete a brief assessment.",
      schedule: { at: new Date(p.scheduled_for) },
      extra: { prompt_id: p.prompt_id }, // passed back when user taps
    })),
  });
}
```

### 4. Handle Notification Tap

```typescript
import { LocalNotifications } from "@capacitor/local-notifications";

LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
  const promptId = action.notification.extra?.prompt_id;
  if (!promptId) return;

  // 1. Update prompt status: "sent" → "opened"
  complianceTracker.markOpened(promptId);

  // 2. Check expiry — if past expiry window, mark expired instead
  const prompt = complianceTracker.getPrompt(promptId);
  const expiryMs = protocol.schedule.expiry_minutes * 60_000;
  if (Date.now() - new Date(prompt.sent_at!).getTime() > expiryMs) {
    complianceTracker.markExpired(promptId);
    return;
  }

  // 3. Fire SESSION_START to WebView via bridge
  sendToNative({ type: "SESSION_START", prompt_id: promptId, protocol });
});
```

### 5. Expiry Checking (Background Runner)

```javascript
// public/background.js
addEventListener("checkSchedule", async (resolve, reject) => {
  const prompts = await BackgroundRunner.getData({ key: "pending_prompts" });
  const now = Date.now();
  const expiryMs = await BackgroundRunner.getData({ key: "expiry_ms" });

  for (const p of prompts) {
    if (p.status === "sent" && now - p.sent_at > expiryMs) {
      p.status = "expired";
      // store back
    }
    if (p.status === "scheduled" && now > p.scheduled_for) {
      p.status = "missed"; // notification was due but never sent (edge case)
    }
  }

  await BackgroundRunner.setData({ key: "pending_prompts", value: prompts });
  resolve();
});
```

## Compliance Tracker

```typescript
// compliance-tracker.ts
import { LocalDatabase } from "@m2c2kit/db";
import type { PromptLogEntry } from "../../contracts/prompt-log.schema";

export class ComplianceTracker {
  constructor(private db: LocalDatabase) {}

  async createPrompt(entry: Omit<PromptLogEntry, "status">): Promise<void> {
    await this.db.setItem("prompt_" + entry.prompt_id, {
      ...entry,
      status: "scheduled",
    });
  }

  async markSent(promptId: string) {
    await this.updateStatus(promptId, "sent", {
      sent_at: new Date().toISOString(),
    });
  }

  async markOpened(promptId: string) {
    await this.updateStatus(promptId, "opened", {
      opened_at: new Date().toISOString(),
    });
  }

  async markStarted(promptId: string, sessionUuid: string) {
    await this.updateStatus(promptId, "started", {
      assessment_started_at: new Date().toISOString(),
      session_uuid: sessionUuid,
    });
  }

  async markCompleted(promptId: string, quitEarly: boolean, nTrials: number) {
    await this.updateStatus(promptId, quitEarly ? "quit_early" : "completed", {
      assessment_ended_at: new Date().toISOString(),
      quit_early: quitEarly,
      n_trials_completed: nTrials,
    });
  }

  async markExpired(promptId: string) {
    await this.updateStatus(promptId, "expired");
  }

  async markMissed(promptId: string) {
    await this.updateStatus(promptId, "missed");
  }

  async getComplianceRate(): Promise<number> {
    // completed / (completed + missed + expired)
  }
}
```

## Compliance Metrics to Track

| Metric                | Formula                                      |
| --------------------- | -------------------------------------------- |
| Response rate         | `completed / (completed + missed + expired)` |
| Completion rate       | `completed / opened`                         |
| Mean response latency | `opened_at - sent_at` (ms)                   |
| Early quit rate       | `quit_early / (completed + quit_early)`      |

### 6. Protocol Hot-Swap (Remote Update)

When Data & Sync detects a new protocol version from the server, it emits `PROTOCOL_UPDATED` via the bridge. The Scheduler must handle this cleanly mid-study:

```typescript
import { LocalNotifications } from "@capacitor/local-notifications";

export async function applyProtocolUpdate(newProtocol: StudyProtocol) {
  // 1. Cancel all pending local notifications
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  // 2. Save new protocol locally
  await Preferences.set({
    key: "study_protocol",
    value: JSON.stringify(newProtocol),
  });

  // 3. Regenerate schedule from today (do not backfill past days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newSchedule = generateSchedule(newProtocol, today);

  // 4. Filter to future prompts only
  const futurePrompts = newSchedule.filter(
    (p) => new Date(p.scheduled_for) > new Date(),
  );

  // 5. Re-register notifications
  await scheduleNotifications(futurePrompts);

  // 6. Persist updated prompt list for background runner
  await BackgroundRunner.setData({
    key: "pending_prompts",
    value: futurePrompts,
  });
}
```

**Caveats to handle:**

- iOS caps local notifications at **64**. If the new protocol generates more, truncate to the nearest 64 future prompts and re-schedule in batches as they are consumed.
- Prompts already `completed`, `missed`, or `expired` under the old protocol are **not** deleted — they remain in the compliance log for research integrity.
- If the participant is mid-assessment when `PROTOCOL_UPDATED` fires, defer the hot-swap until `SESSION_LIFECYCLE: ended` is received.

## Integration Points

- **Receives from Protocol Architect:** `StudyProtocol` schema, `PromptLogEntry` schema
- **Sends to Native Platform:** schedule of notifications to register, prompt_id on tap
- **Sends to Data & Sync:** completed `PromptLogEntry` rows for server upload
- **Receives from Assessment Engineer:** `session_uuid` and trial count after session ends (via bridge event `COMPLIANCE_UPDATE`)
- **Receives from Data & Sync:** `PROTOCOL_UPDATED` event when server returns a newer protocol version

## Does NOT

- Write Kotlin or Swift code
- Store raw GPS data (that's Native Platform + Data & Sync)
- Design the backend API
- Render any UI
- Fetch the protocol from the server (that's Data & Sync)
