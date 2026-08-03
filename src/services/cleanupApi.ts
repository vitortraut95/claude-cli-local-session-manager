import axios from "axios";

const client = axios.create({
  baseURL: "/cleanup",
});

type ErrorResponseBody = { error?: unknown };

/** Mirrors sessionsApi's/tasksApi's withServerErrorMessage — surfaces the server's own
 *  `{ error }` message instead of axios's generic "Request failed with status code ..." */
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

export type CleanupFinding = {
  id: string;
  kind: "prune-worktrees" | "remove-merged-worktree";
  title: string;
  description: string;
  command: string;
  repoRoot: string;
  worktreePath: string | null;
  branch: string | null;
};

export async function fetchCleanupFindings(): Promise<CleanupFinding[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ findings: CleanupFinding[] }>("/findings"),
  );
  return data.findings;
}

/** Sends the exact finding object the list returned — the server re-validates it from scratch
 *  rather than trusting it, so this is just "which one to act on", not a shortcut around safety
 *  checks. */
export async function executeCleanupFinding(finding: CleanupFinding): Promise<void> {
  await withServerErrorMessage(() => client.post("/findings/execute", finding));
}
