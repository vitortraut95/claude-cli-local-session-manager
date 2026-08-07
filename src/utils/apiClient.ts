import axios from "axios";

type ErrorResponseBody = { error?: unknown };

/** Re-throws with the server's specific error message (e.g. "session is active") instead of
 *  axios's generic "Request failed with status code 409", so callers' existing
 *  `err instanceof Error ? err.message : ...` catch blocks surface something actually useful.
 *  Shared by every `src/services/*Api.ts` file — each one used to carry its own byte-identical
 *  copy of this function. */
export async function withServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (axios.isAxiosError<ErrorResponseBody>(err) && typeof err.response?.data?.error === "string") {
      throw new Error(err.response.data.error, { cause: err });
    }
    throw err;
  }
}
