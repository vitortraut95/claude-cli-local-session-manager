import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type { ResumeOpenResult } from "./sessionsApi";
import type {
  ClaudeUsageStatus,
  LimuxInstallResult,
  LimuxStatus,
  UpdateJobStatus,
  UpdateStatus,
} from "../../shared/system";
export type {
  ClaudeExtraUsage,
  ClaudeUsageLimit,
  ClaudeUsageStatus,
  LimuxInstallResult,
  LimuxStatus,
  UpdateJobStatus,
  UpdateStatus,
} from "../../shared/system";

const client = axios.create({
  baseURL: "/system",
});

export async function fetchUpdateStatus(): Promise<UpdateStatus> {
  const { data } = await client.get<UpdateStatus>("/update-status");
  return data;
}

/** `force` = discard local changes (the user confirmed); without it the server refuses them. */
export async function applyUpdate(force = false): Promise<void> {
  await withServerErrorMessage(() => client.post("/update", { force }));
}

export async function fetchUpdateJobStatus(): Promise<UpdateJobStatus> {
  const { data } = await client.get<UpdateJobStatus>("/update-job");
  return data;
}

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

export async function fetchLimuxStatus(): Promise<LimuxStatus> {
  const { data } = await withServerErrorMessage(() => client.get<LimuxStatus>("/limux"));
  return data;
}

/** Installs Limux, or updates it to the newest release, under `~/.local` (no sudo). */
export async function installLimux(): Promise<LimuxInstallResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<LimuxInstallResult>("/limux/install"),
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
