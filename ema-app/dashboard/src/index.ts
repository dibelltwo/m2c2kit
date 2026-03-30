import {
  type BackendHealth,
  dashboardApi,
  type ComplianceSummary,
  type ParticipantSummary,
  type ProtocolVersionSummary,
} from "./api-client";
import type { StudyProtocol } from "../../../contracts/study-protocol.schema";
import { dashboardStyles } from "./styles";

type PageId = "overview" | "participants" | "protocol" | "exports";

type DashboardState = {
  page: PageId;
  studyId: string;
  participants: ParticipantSummary[];
  selectedParticipantId: string | null;
  backendHealth: BackendHealth | null;
  compliance: ComplianceSummary | null;
  protocolText: string;
  protocolMessage: string;
  protocolVersions: ProtocolVersionSummary[];
  exportMessage: string;
  exportUrl: string | null;
};

type ProtocolSummary = {
  version: number | null;
  packageNames: string[];
  ruleCount: number;
  questionCount: number;
  defaultPackageName: string | null;
};

type GoalStatus = "done" | "active" | "next";

type GoalProgressItem = {
  title: string;
  status: GoalStatus;
  detail: string;
  percent: number;
};

const state: DashboardState = {
  page: "overview",
  studyId: "dev-study",
  participants: [],
  selectedParticipantId: null,
  backendHealth: null,
  compliance: null,
  protocolText: "",
  protocolMessage: "",
  protocolVersions: [],
  exportMessage: "",
  exportUrl: null,
};

const goalProgress: GoalProgressItem[] = [
  {
    title: "Package-native participant runtime",
    status: "done",
    detail:
      "Scheduler, package launch path, and setup flow are working in the prototype.",
    percent: 100,
  },
  {
    title: "Backend and sync path",
    status: "active",
    detail:
      "Enrollment, uploads, sync-status, compliance, protocol reads, and exports are implemented.",
    percent: 80,
  },
  {
    title: "Researcher dashboard",
    status: "active",
    detail:
      "Overview, participants, protocol editor, export controls, backend health, and goal tracking are available.",
    percent: 75,
  },
  {
    title: "Package-aware exports",
    status: "active",
    detail:
      "The backend now creates real JSON and CSV downloads with protocol versions and collected records.",
    percent: 75,
  },
  {
    title: "Real database mode",
    status: "next",
    detail:
      "Prisma migration files are ready, but Postgres still needs to be turned on in a real runtime.",
    percent: 55,
  },
  {
    title: "Native iPhone and Android app hardening",
    status: "next",
    detail:
      "This comes after backend, dashboard, and database flow are stable.",
    percent: 15,
  },
];

const app = document.getElementById("app");

if (!app) {
  throw new Error("Dashboard root element not found");
}

function mountStyles() {
  const style = document.createElement("style");
  style.textContent = dashboardStyles;
  document.head.appendChild(style);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getProtocolSummary(protocolText: string): ProtocolSummary {
  try {
    const protocol = JSON.parse(protocolText) as StudyProtocol;
    const packageNames =
      protocol.packages?.map((pkg) => pkg.package_name) ?? [];
    const defaultPackageName =
      protocol.packages?.find(
        (pkg) => pkg.package_id === protocol.default_package_id,
      )?.package_name ?? null;

    return {
      version: typeof protocol.version === "number" ? protocol.version : null,
      packageNames,
      ruleCount: protocol.schedule_rules?.length ?? 0,
      questionCount:
        protocol.question_bank?.length ?? protocol.ema_survey.items.length,
      defaultPackageName,
    };
  } catch {
    return {
      version: null,
      packageNames: [],
      ruleCount: 0,
      questionCount: 0,
      defaultPackageName: null,
    };
  }
}

function renderProtocolSummaryBlock(): string {
  const summary = getProtocolSummary(state.protocolText);
  return `
    <div class="panel-block">
      <h3>Protocol Snapshot</h3>
      <div class="chip-row">
        <span class="chip">Protocol v${escapeHtml(summary.version ?? "—")}</span>
        <span class="chip">${summary.questionCount} questions</span>
        <span class="chip">${summary.ruleCount} schedule rules</span>
        <span class="chip">Default ${escapeHtml(summary.defaultPackageName ?? "—")}</span>
      </div>
      <div class="chip-row" style="margin-top: 10px;">
        ${
          summary.packageNames.length > 0
            ? summary.packageNames
                .map((name) => `<span class="chip">${escapeHtml(name)}</span>`)
                .join("")
            : '<span class="chip">No packages loaded</span>'
        }
      </div>
      ${
        state.protocolVersions.length > 0
          ? `
            <div class="chip-row" style="margin-top: 10px;">
              ${state.protocolVersions
                .map(
                  (entry) =>
                    `<span class="chip">v${escapeHtml(entry.version)} · ${escapeHtml(entry.updated_at)}</span>`,
                )
                .join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderBackendStatusBlock(): string {
  const health = state.backendHealth;
  const statusLabel = health?.ok ? "Connected" : "Unknown";
  const serviceLabel = health?.service ?? "ema-server";
  const timestampLabel = health?.timestamp ?? "Not loaded yet";
  const storageMode = health?.storage_mode ?? "unknown";
  const counts = health?.counts;

  return `
    <div class="panel-block">
      <h3>Backend Status</h3>
      <div class="chip-row">
        <span class="chip">${escapeHtml(statusLabel)}</span>
        <span class="chip">${escapeHtml(serviceLabel)}</span>
        <span class="chip">Storage ${escapeHtml(storageMode)}</span>
      </div>
      <p class="muted">Last backend check: ${escapeHtml(timestampLabel)}</p>
      ${
        counts
          ? `
            <div class="chip-row">
              <span class="chip">Participants ${counts.participants}</span>
              <span class="chip">Protocols ${counts.protocol_versions}</span>
              <span class="chip">Sessions ${counts.sessions}</span>
              <span class="chip">Prompt logs ${counts.prompt_logs}</span>
            </div>
          `
          : ""
      }
      <p class="muted">
        This shows whether the dashboard can currently talk to the EMA backend.
      </p>
    </div>
  `;
}

function renderGoalProgressBlock(): string {
  const averageProgress =
    Math.round(
      goalProgress.reduce((sum, goal) => sum + goal.percent, 0) /
        goalProgress.length,
    ) || 0;
  return `
    <div class="panel-block">
      <h3>Goal Progress</h3>
      <div class="progress-summary">
        <strong>${averageProgress}% overall</strong>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" style="width: ${averageProgress}%"></div>
        </div>
      </div>
      <div class="goal-list">
        ${goalProgress
          .map(
            (goal) => `
              <div class="goal-item">
                <div class="chip-row">
                  <span class="chip goal-chip ${goal.status}">${escapeHtml(goal.status.toUpperCase())}</span>
                  <strong>${escapeHtml(goal.title)}</strong>
                </div>
                <p class="muted">${escapeHtml(goal.detail)}</p>
                <div class="progress-track small" aria-hidden="true">
                  <div class="progress-fill ${goal.status}" style="width: ${goal.percent}%"></div>
                </div>
                <p class="muted goal-percent">${goal.percent}% complete</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOverview(): string {
  const compliance = state.compliance;
  const protocolSummary = getProtocolSummary(state.protocolText);
  const latestParticipant = state.participants.at(-1) ?? null;
  const latestProtocolVersion =
    state.protocolVersions[0]?.version ?? protocolSummary.version ?? null;

  return `
    <section class="page-panel">
      <h2>Study Overview</h2>
      <p>Package-native EMA configuration, participant status, and export readiness in one place.</p>
      <div class="metric-grid">
        <article class="metric-card">
          <h3>Participants</h3>
          <strong>${state.participants.length}</strong>
          <p>Currently loaded for study ${escapeHtml(state.studyId)}.</p>
        </article>
        <article class="metric-card">
          <h3>Response Rate</h3>
          <strong>${compliance ? formatPercent(compliance.response_rate) : "--"}</strong>
          <p>Based on the selected participant.</p>
        </article>
        <article class="metric-card">
          <h3>Completion Rate</h3>
          <strong>${compliance ? formatPercent(compliance.completion_rate) : "--"}</strong>
          <p>Completed packages over prompt opportunities.</p>
        </article>
        <article class="metric-card">
          <h3>Missed Prompts</h3>
          <strong>${compliance ? compliance.missed_prompts : "--"}</strong>
          <p>Current missed count for the selected participant.</p>
        </article>
      </div>
      <div class="split-grid">
        ${renderProtocolSummaryBlock()}
        ${renderBackendStatusBlock()}
      </div>
      <div class="split-grid">
        ${renderGoalProgressBlock()}
        <div class="panel-block">
          <h3>Activity Snapshot</h3>
          <div class="chip-row">
            <span class="chip">Participants ${state.participants.length}</span>
            <span class="chip">Latest protocol v${escapeHtml(latestProtocolVersion ?? "—")}</span>
            <span class="chip">${dashboardApi.isDemoMode() ? "Demo mode" : "Live backend"}</span>
          </div>
          <p class="muted">Backend check: ${escapeHtml(state.backendHealth?.timestamp ?? "Not loaded yet")}</p>
          <p class="muted">Most recent participant: ${escapeHtml(latestParticipant?.participant_id ?? "None yet")}</p>
          <p class="muted">Latest export: ${escapeHtml(state.exportMessage || "No export started yet")}</p>
        </div>
        <div class="panel-block">
          <h3>Current Study Posture</h3>
          <p class="muted">
            ${
              protocolSummary.packageNames.length > 0
                ? `Loaded package-native protocol with ${protocolSummary.packageNames.length} packages.`
                : "No protocol loaded yet."
            }
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderParticipants(): string {
  const rows = state.participants
    .map(
      (participant) => `
        <tr>
          <td>${escapeHtml(participant.participant_id)}</td>
          <td>${escapeHtml(participant.study_id)}</td>
          <td>${escapeHtml(participant.enrolled_at)}</td>
          <td>${escapeHtml(participant.last_sync_at ?? "—")}</td>
          <td>
            <button class="ghost-btn" data-action="select-participant" data-id="${escapeHtml(participant.participant_id)}">
              Inspect
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <section class="page-panel">
      <h2>Participants</h2>
      <div class="toolbar">
        <input id="study-id-input" value="${escapeHtml(state.studyId)}" />
        <button class="action-btn" data-action="reload-participants">Reload Participants</button>
      </div>
      <table class="list-table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Study</th>
            <th>Enrolled</th>
            <th>Last Sync</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="panel-block">
        <h3>Compliance Detail</h3>
        ${
          state.compliance && state.selectedParticipantId
            ? `
              <p><strong>${escapeHtml(state.selectedParticipantId)}</strong></p>
              <div class="chip-row">
                <span class="chip">Response ${formatPercent(state.compliance.response_rate)}</span>
                <span class="chip">Completion ${formatPercent(state.compliance.completion_rate)}</span>
                <span class="chip">Completed ${state.compliance.completed_prompts}</span>
                <span class="chip">Missed ${state.compliance.missed_prompts}</span>
              </div>
              <p class="muted">Last prompt: ${escapeHtml(state.compliance.last_prompt_at ?? "—")}</p>
            `
            : `<p class="muted">Select a participant to inspect compliance.</p>`
        }
      </div>
      ${renderProtocolSummaryBlock()}
    </section>
  `;
}

function renderProtocol(): string {
  return `
    <section class="page-panel">
      <h2>Protocol Editor</h2>
      <p>Edit the current study protocol JSON, validate it locally, and push a new version when the backend is ready.</p>
      ${state.protocolMessage ? `<div class="notice">${escapeHtml(state.protocolMessage)}</div>` : ""}
      <div class="toolbar">
        <button class="action-btn" data-action="load-protocol">Load Protocol</button>
        <button class="ghost-btn" data-action="validate-protocol">Validate JSON</button>
        <button class="action-btn" data-action="push-protocol">Push Protocol</button>
      </div>
      <label class="field">
        <span>Study ID</span>
        <input id="protocol-study-id" value="${escapeHtml(state.studyId)}" />
      </label>
      <label class="field">
        <span>StudyProtocol JSON</span>
        <textarea id="protocol-editor">${escapeHtml(state.protocolText)}</textarea>
      </label>
      ${renderProtocolSummaryBlock()}
    </section>
  `;
}

function renderExports(): string {
  return `
    <section class="page-panel">
      <h2>Export Center</h2>
      <p>Start an export job against the current study and poll its readiness.</p>
      ${state.exportMessage ? `<div class="notice">${escapeHtml(state.exportMessage)}</div>` : ""}
      ${
        state.exportUrl
          ? `<p><a class="action-btn" href="${escapeHtml(state.exportUrl)}" target="_blank" rel="noreferrer">Open Export</a></p>`
          : ""
      }
      <div class="field-grid two">
        <label class="field">
          <span>Study ID</span>
          <input id="export-study-id" value="${escapeHtml(state.studyId)}" />
        </label>
        <label class="field">
          <span>Format</span>
          <select id="export-format">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button class="action-btn" data-action="start-export">Start Export</button>
      </div>
    </section>
  `;
}

function renderPage(): string {
  switch (state.page) {
    case "participants":
      return renderParticipants();
    case "protocol":
      return renderProtocol();
    case "exports":
      return renderExports();
    case "overview":
    default:
      return renderOverview();
  }
}

function renderApp() {
  app.innerHTML = `
    <main class="dashboard-shell">
      <div class="dashboard-frame">
        <section class="hero">
          <div class="stack">
            <span class="hero-badge">EMA Researcher Dashboard</span>
            <h1>Package-native study operations</h1>
            <p>Researcher tools for protocol review, participant oversight, and export readiness.</p>
          </div>
          <div class="stack">
            <span class="hero-badge">${dashboardApi.isDemoMode() ? "Demo Data" : "Live API"}</span>
            <span class="hero-badge">Study ${escapeHtml(state.studyId)}</span>
          </div>
        </section>
        <section class="layout">
          <aside class="sidebar">
            <div class="stack">
              <h3>Navigation</h3>
              ${(
                ["overview", "participants", "protocol", "exports"] as PageId[]
              )
                .map(
                  (page) => `
                    <button class="nav-btn ${state.page === page ? "active" : ""}" data-action="nav" data-page="${page}">
                      ${page === "exports" ? "Export Center" : page[0].toUpperCase() + page.slice(1)}
                    </button>
                  `,
                )
                .join("")}
            </div>
            <div class="stack">
              <h3>Study Notes</h3>
              <p class="muted">Current sequence: participant runtime, backend, dashboard, exports, then native hardening.</p>
            </div>
          </aside>
          ${renderPage()}
        </section>
      </div>
    </main>
  `;

  bindUi();
}

async function loadParticipants() {
  state.participants = await dashboardApi.listParticipants(state.studyId);
  if (!state.selectedParticipantId && state.participants.length > 0) {
    state.selectedParticipantId = state.participants[0].participant_id;
  }
}

async function loadBackendHealth() {
  state.backendHealth = await dashboardApi.getHealth();
}

async function loadCompliance(participantId: string) {
  state.selectedParticipantId = participantId;
  state.compliance = await dashboardApi.getCompliance(participantId);
}

async function loadProtocol() {
  const protocol = await dashboardApi.getProtocol(state.studyId);
  state.protocolVersions = await dashboardApi.listProtocolVersions(
    state.studyId,
  );
  state.protocolText = JSON.stringify(protocol, null, 2);
  state.protocolMessage = `Loaded protocol v${protocol.version} for study ${state.studyId}.`;
}

function validateProtocolText(): StudyProtocol {
  const parsed = JSON.parse(state.protocolText) as StudyProtocol;
  if (!parsed.study_id || !parsed.version || !parsed.schedule) {
    throw new Error("Missing required StudyProtocol fields.");
  }
  return parsed;
}

async function pushProtocol() {
  const protocol = validateProtocolText();
  const result = await dashboardApi.pushProtocol(state.studyId, protocol);
  state.protocolVersions = await dashboardApi.listProtocolVersions(
    state.studyId,
  );
  state.protocolMessage = `Protocol pushed. Version ${result.version}.`;
}

async function startExport() {
  const exportStudyIdInput = document.getElementById(
    "export-study-id",
  ) as HTMLInputElement | null;
  const exportFormatInput = document.getElementById(
    "export-format",
  ) as HTMLSelectElement | null;
  const studyId = exportStudyIdInput?.value.trim() || state.studyId;
  const format = (exportFormatInput?.value || "csv") as "csv" | "json";
  const { job_id } = await dashboardApi.startExport(studyId, format);
  const job = await dashboardApi.pollExportJob(job_id);
  state.exportUrl = job.download_url ?? null;
  state.exportMessage =
    job.status === "ready"
      ? `Export ready: ${job.download_url ?? "(no download URL yet)"}`
      : `Export job ${job.job_id} is ${job.status}${job.error ? `: ${job.error}` : ""}.`;
}

function bindUi() {
  app.querySelectorAll<HTMLElement>("[data-action='nav']").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.page as PageId;
      renderApp();
    });
  });

  app
    .querySelector("[data-action='reload-participants']")
    ?.addEventListener("click", async () => {
      const studyInput = document.getElementById(
        "study-id-input",
      ) as HTMLInputElement | null;
      state.studyId = studyInput?.value.trim() || state.studyId;
      await loadParticipants();
      if (state.selectedParticipantId) {
        await loadCompliance(state.selectedParticipantId);
      }
      renderApp();
    });

  app
    .querySelectorAll<HTMLElement>("[data-action='select-participant']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        if (!id) return;
        await loadCompliance(id);
        renderApp();
      });
    });

  app
    .querySelector("[data-action='load-protocol']")
    ?.addEventListener("click", async () => {
      const studyInput = document.getElementById(
        "protocol-study-id",
      ) as HTMLInputElement | null;
      if (studyInput?.value.trim()) {
        state.studyId = studyInput.value.trim();
      }
      await loadProtocol();
      renderApp();
    });

  app
    .querySelector("[data-action='validate-protocol']")
    ?.addEventListener("click", () => {
      const editor = document.getElementById(
        "protocol-editor",
      ) as HTMLTextAreaElement | null;
      state.protocolText = editor?.value ?? state.protocolText;
      try {
        const protocol = validateProtocolText();
        state.protocolMessage = `Valid JSON. Study ${protocol.study_id}, protocol v${protocol.version}.`;
      } catch (error) {
        state.protocolMessage = (error as Error).message;
      }
      renderApp();
    });

  app
    .querySelector("[data-action='push-protocol']")
    ?.addEventListener("click", async () => {
      const editor = document.getElementById(
        "protocol-editor",
      ) as HTMLTextAreaElement | null;
      state.protocolText = editor?.value ?? state.protocolText;
      try {
        await pushProtocol();
      } catch (error) {
        state.protocolMessage = `Push failed: ${(error as Error).message}`;
      }
      renderApp();
    });

  app
    .querySelector("[data-action='start-export']")
    ?.addEventListener("click", async () => {
      try {
        await startExport();
      } catch (error) {
        state.exportMessage = `Export failed: ${(error as Error).message}`;
      }
      renderApp();
    });
}

async function bootstrap() {
  mountStyles();
  await loadBackendHealth();
  await loadParticipants();
  if (state.selectedParticipantId) {
    await loadCompliance(state.selectedParticipantId);
    await loadProtocol();
  }
  renderApp();
}

void bootstrap();
