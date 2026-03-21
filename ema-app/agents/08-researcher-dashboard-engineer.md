# Agent 08 — Researcher Dashboard Engineer

## Role

Build the researcher-facing web dashboard for managing study participants, pushing protocol updates, monitoring compliance, and downloading data. This is a standalone web app served separately from the mobile app. Auth is via static API key (set in backend env vars).

## Owns

```
ema-app/dashboard/
  src/
    api-client.ts         ← typed wrapper over researcher API endpoints
    pages/
      participants.ts     ← list all participants + enrollment status
      participant.ts      ← per-participant compliance detail
      protocol-editor.ts  ← load, edit, and push new protocol version
      export.ts           ← trigger async export + poll + download
    components/
      compliance-table.ts ← reusable compliance metrics display
      protocol-form.ts    ← JSON editor + validation for StudyProtocol
    styles/
      dashboard.css
  index.html
  rollup.config.mjs
  tsconfig.json
```

## Pages & Flow

```
┌──────────────────────────────────┐
│  Participants List                │  GET /participants?study_id=X
│  participant_id | enrolled_at    │
│  compliance % | last sync        │
│  [View] [Export Study]           │
└─────────────────┬────────────────┘
                  ↓ [View]
┌──────────────────────────────────┐
│  Participant Detail              │  GET /participants/:id/compliance
│  response_rate | completion_rate │
│  mean_latency | quit_early_rate  │
│  prompt timeline (sent/missed)   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Protocol Editor                 │  GET /participants/:id/protocol
│  JSON editor (StudyProtocol)     │  PUT /studies/:study_id/protocol
│  version: N → N+1               │
│  [Validate] [Push to Study]      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Export                          │  POST /studies/:study_id/export
│  format: CSV | JSON              │  GET /export-jobs/:id (poll)
│  [Start Export] → polling...     │
│  [Download zip]                  │
└──────────────────────────────────┘
```

## API Client

```typescript
// api-client.ts
const API_BASE =
  (window as any).__DASHBOARD_API_BASE__ ?? "http://localhost:3000/v1";
const API_KEY = (window as any).__DASHBOARD_API_KEY__;

async function apiRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res;
}

export const dashboardApi = {
  listParticipants: (studyId?: string) =>
    apiRequest(`/participants${studyId ? `?study_id=${studyId}` : ""}`).then(
      (r) => r.json(),
    ),

  getCompliance: (participantId: string) =>
    apiRequest(`/participants/${participantId}/compliance`).then((r) =>
      r.json(),
    ),

  getProtocol: (participantId: string) =>
    apiRequest(`/participants/${participantId}/protocol`).then((r) => r.json()),

  pushProtocol: (studyId: string, protocol: StudyProtocol) =>
    apiRequest(`/studies/${studyId}/protocol`, {
      method: "PUT",
      body: JSON.stringify(protocol),
    }).then((r) => r.json()),

  startExport: (studyId: string, format: "csv" | "json") =>
    apiRequest(`/studies/${studyId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }).then((r) => r.json()), // → { job_id }

  pollExportJob: (jobId: string) =>
    apiRequest(`/export-jobs/${jobId}`).then((r) => r.json()), // → { status, download_url? }
};
```

## Protocol Editor

The researcher loads the current protocol, edits it in a JSON textarea (with live validation against `StudyProtocol` schema), increments `version`, and pushes it. The app will receive the update on its next sync cycle.

```typescript
// protocol-editor.ts
async function pushProtocol(studyId: string) {
  const raw = editorTextarea.value;
  let parsed: StudyProtocol;

  try {
    parsed = JSON.parse(raw);
  } catch {
    showError("Invalid JSON");
    return;
  }

  // Validate required fields
  if (
    !parsed.study_id ||
    !parsed.version ||
    !parsed.schedule ||
    !parsed.assessments
  ) {
    showError("Missing required fields");
    return;
  }

  const result = await dashboardApi.pushProtocol(studyId, parsed);
  showSuccess(`Protocol pushed. New version: ${result.version}`);
}
```

**Important:** The researcher must manually increment `version` (integer) before pushing. The server rejects pushes with `version <=` the current stored version.

## Export Flow

```typescript
// export.ts
async function runExport(studyId: string, format: "csv" | "json") {
  exportBtn.disabled = true;
  statusEl.textContent = "Starting export...";

  const { job_id } = await dashboardApi.startExport(studyId, format);

  // Poll every 3 seconds
  const interval = setInterval(async () => {
    const job = await dashboardApi.pollExportJob(job_id);
    if (job.status === "ready") {
      clearInterval(interval);
      statusEl.textContent = "Ready.";
      downloadLink.href = job.download_url;
      downloadLink.style.display = "block";
      exportBtn.disabled = false;
    } else if (job.status === "failed") {
      clearInterval(interval);
      statusEl.textContent = "Export failed. Try again.";
      exportBtn.disabled = false;
    } else {
      statusEl.textContent = `Export in progress (${job_id})...`;
    }
  }, 3000);
}
```

## Build

```
// rollup.config.mjs — same toolchain as rest of m2c2kit
export default {
  input: "src/index.ts",
  output: { file: "dist/dashboard.js", format: "iife" },
  plugins: [typescript(), nodeResolve()],
};
```

Served as a static site (nginx or any static host). API key and base URL injected at deploy time via `__DASHBOARD_API_BASE__` / `__DASHBOARD_API_KEY__` globals in `index.html`.

## Design Constraints

- **No React/Vue** — plain TypeScript + DOM (consistent with Agent 06)
- **No external CSS frameworks** — minimal vanilla CSS
- **Not exposed to participants** — protected by API key; deploy separately from any public URL
- **No auth UI** — API key is set at deploy time, not entered at login

## Caveats to Document for Researcher

- Protocol updates are **pull-based**: the app checks on each sync cycle (~15 min background, immediate on foreground). There is no instant push.
- A participant who is **offline** will not receive the update until they reconnect.
- Protocol changes take effect **from the next unscheduled prompt forward** — past missed/completed prompts are not retroactively affected.
- Export data reflects what the server has received — if a participant hasn't synced recently, their latest sessions will be absent from the export.

## Integration Points

- **Calls:** Backend Engineer's researcher API endpoints (API key auth)
- **Reads contracts from:** Protocol Architect (`study-protocol.schema.ts`, `api.openapi.yaml`)
- **Does not touch:** Mobile app code, Capacitor, notifications, or IndexedDB

## Does NOT

- Write backend implementation code
- Write mobile app code
- Handle participant-facing UI (that's Agent 06)
- Implement data sync (that's Agent 04)
