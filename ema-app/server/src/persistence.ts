import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PersistedState = {
  participants: Record<string, unknown>[];
  studyProtocols: Record<string, unknown>[];
  promptLogs: Record<string, unknown>[];
  contextSnapshots: Record<string, unknown>[];
  surveyResponses: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  exportJobs: Record<string, unknown>[];
};

const rootDir = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(rootDir, "../data/state.json");

const emptyState: PersistedState = {
  participants: [],
  studyProtocols: [],
  promptLogs: [],
  contextSnapshots: [],
  surveyResponses: [],
  sessions: [],
  exportJobs: [],
};

export async function loadPersistedState(): Promise<PersistedState> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      participants: Array.isArray(parsed.participants)
        ? parsed.participants
        : [],
      studyProtocols: Array.isArray(parsed.studyProtocols)
        ? parsed.studyProtocols
        : [],
      promptLogs: Array.isArray(parsed.promptLogs) ? parsed.promptLogs : [],
      contextSnapshots: Array.isArray(parsed.contextSnapshots)
        ? parsed.contextSnapshots
        : [],
      surveyResponses: Array.isArray(parsed.surveyResponses)
        ? parsed.surveyResponses
        : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      exportJobs: Array.isArray(parsed.exportJobs) ? parsed.exportJobs : [],
    };
  } catch {
    return { ...emptyState };
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  const body = `${JSON.stringify(state, null, 2)}\n`;
  await writeFile(tempFile, body, "utf8");
  await rename(tempFile, dataFile);
}
