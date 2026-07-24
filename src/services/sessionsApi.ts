import axios from "axios";
import type { Session } from "../types/session";

const client = axios.create({
  baseURL: "/sessions",
});

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await client.delete(`/${encodeURIComponent(id)}`);
}

export async function continueSession(id: string): Promise<void> {
  await client.post(`/${encodeURIComponent(id)}/continue`);
}

type ErrorResponseBody = { error?: unknown };

export async function renameSession(id: string, title: string): Promise<void> {
  try {
    await client.patch(`/${encodeURIComponent(id)}/title`, { title });
  } catch (err) {
    // Re-throw with the server's specific message (e.g. "session is active") so the caller's
    // generic `err instanceof Error ? err.message : ...` catch surfaces it, instead of axios's
    // own generic "Request failed with status code 409".
    if (axios.isAxiosError<ErrorResponseBody>(err) && typeof err.response?.data?.error === "string") {
      throw new Error(err.response.data.error, { cause: err });
    }
    throw err;
  }
}
