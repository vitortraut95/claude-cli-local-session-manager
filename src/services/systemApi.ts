import axios from "axios";

const client = axios.create({
  baseURL: "/system",
});

export async function stopApplication(): Promise<void> {
  await client.post("/shutdown");
}

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
