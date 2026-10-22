import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type { ResumeOpenResult } from "./sessionsApi";

const client = axios.create({
  baseURL: "/system",
});

export type UpdateStatus = {
  branch: string;
  tracking: string;
  ahead: number;
  behind: number;
  updateAvailable: boolean;
};

export async function fetchUpdateStatus(): Promise<UpdateStatus> {
  const { data } = await client.get<UpdateStatus>("/update-status");
  return data;
}

export type UpdateJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string }
  | { state: "success"; branch: string; pullSummary: string; finishedAt: string }
  | { state: "error"; message: string; code?: string; finishedAt: string };

export async function applyUpdate(): Promise<void> {
  await client.post("/update");
}

export async function fetchUpdateJobStatus(): Promise<UpdateJobStatus> {
  const { data } = await client.get<UpdateJobStatus>("/update-job");
  return data;
}

export type ClaudeUsageLimit = {
  kind: string;
  group: string;
  percent: number;
  severity: string;
  resetsAt: string | null;
  isActive: boolean;
};

export type ClaudeExtraUsage = {
  isEnabled: boolean;
  monthlyLimit: number;
  usedCredits: number;
  utilization: number | null;
  currency: string;
};

export type ClaudeUsageStatus = {
  limits: ClaudeUsageLimit[];
  extraUsage: ClaudeExtraUsage | null;
  /** When this reading was fetched. Optional: older backend. */
  fetchedAt?: string;
  /** Anthropic is rate-limiting the usage endpoint: the last good reading, kept meanwhile. */
  stale?: boolean;
};

/** `forceRefresh` bypasses the server's short cache. */
export async function fetchUsageLimits(forceRefresh = false): Promise<ClaudeUsageStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<ClaudeUsageStatus>("/usage-limits", {
      params: forceRefresh ? { refresh: "1" } : undefined,
    }),
  );
  return data;
}

/** The Limux grid Claude sessions open in when `terminalLayout` is "limux-grid". */
export type TerminalGridStatus = { available: boolean; running: boolean; panes: number };

export async function fetchTerminalGridStatus(): Promise<TerminalGridStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<TerminalGridStatus>("/terminal-grid"),
  );
  return data;
}

/** "Open grid": brings Limux up and resumes into it every open task with nothing running. */
export async function openTerminalGrid(): Promise<ResumeOpenResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<ResumeOpenResult>("/terminal-grid/open"),
  );
  return data;
}

/** Stops a task worktree's preview (container stopped / process ended). */
export async function stopPreview(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/previews/${encodeURIComponent(id)}/stop`));
}

/** Removes a task worktree's preview container (running or stopped). */
export async function removePreview(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/previews/${encodeURIComponent(id)}/remove`));
}

/** Starts a task worktree's stopped preview container again. */
export async function startPreview(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/previews/${encodeURIComponent(id)}/start`));
}
