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

export async function applyUpdate(): Promise<void> {
  await client.post("/update");
}
