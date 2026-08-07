import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/system",
});

export type UpdateStatus = {
  branch: string;
  tracking: string | null;
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
  | { state: "error"; message: string; finishedAt: string };

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
};

/** `forceRefresh` bypasses the server's own short cache — used by the header widget's manual
 *  refresh button, since a plain mount-time fetch is happy with a slightly stale value. */
export async function fetchUsageLimits(forceRefresh = false): Promise<ClaudeUsageStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<ClaudeUsageStatus>("/usage-limits", {
      params: forceRefresh ? { refresh: "1" } : undefined,
    }),
  );
  return data;
}
