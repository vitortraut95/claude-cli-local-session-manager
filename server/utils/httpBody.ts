/** Shared by every route file that reads fields off an Express `req.body` of unknown shape —
 *  each one used to carry its own byte-identical copy of these two functions. */

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
