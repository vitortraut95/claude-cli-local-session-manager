import { BadRequestError } from "./httpError.js";
import { isWorkStatus, WORK_STATUSES, type WorkStatus } from "./taskStore.js";

/** Typed field readers for an Express `req.body` of unknown shape. */

export function extractStringField(body: unknown, key: string): string {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function extractBooleanField(body: unknown, key: string, defaultValue: boolean): boolean {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "boolean") return value;
  }
  return defaultValue;
}

/** `{ status }`: one of `WORK_STATUSES`, or null/"" to clear it. */
export function parseWorkStatus(body: unknown): WorkStatus | null {
  const value: unknown = (body as Record<string, unknown> | null)?.status;
  if (value === null || value === "" || value === undefined) return null;
  if (isWorkStatus(value)) return value;
  throw new BadRequestError(
    "INVALID_WORK_STATUS",
    `status must be one of ${WORK_STATUSES.join(", ")} (or null).`,
  );
}
