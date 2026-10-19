import type { UserPreferences } from "../services/tasksApi";

/** Downloads the preferences as `userPreferences.json` (Settings → Export). */
export function downloadPreferences(prefs: UserPreferences): void {
  const blob = new Blob([`${JSON.stringify(prefs, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "userPreferences.json";
  link.click();
  URL.revokeObjectURL(url);
}

/** Parsed JSON of a picked file; throws on invalid JSON. */
export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text()) as unknown;
}
