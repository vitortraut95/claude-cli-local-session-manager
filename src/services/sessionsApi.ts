import axios from "axios";
import type { Session } from "../types/session";

const client = axios.create({
  baseURL: "/sessions",
});

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
}

type ErrorResponseBody = { error?: unknown };

/**
 * Re-throws with the server's specific error message (e.g. "session is active") instead of
 * axios's generic "Request failed with status code 409", so callers' existing
 * `err instanceof Error ? err.message : ...` catch blocks surface something actually useful.
 */
async function withServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (axios.isAxiosError<ErrorResponseBody>(err) && typeof err.response?.data?.error === "string") {
      throw new Error(err.response.data.error, { cause: err });
    }
    throw err;
  }
}

export async function deleteSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}`));
}

export async function continueSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/continue`));
}

export async function setNickname(id: string, nickname: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.patch(`/${encodeURIComponent(id)}/nickname`, { nickname }),
  );
}

/** Full, untruncated prompts for one session — see PromptPreviewModal for why this is fetched
 *  separately from `Session.prompts` rather than reused (that copy is capped for the list payload). */
export async function fetchSessionPrompts(id: string): Promise<string[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ prompts: string[] }>(`/${encodeURIComponent(id)}/prompts`),
  );
  return data.prompts;
}
