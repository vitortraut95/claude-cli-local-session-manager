import { getUserPreferences } from "../preferencesService.js";

/**
 * Calls on `deps`' providers (board, code host, notifier, task sink) throw once `signal` aborts,
 * so a look under way when the switch goes off stops before its next write.
 */
export function guardDeps<T extends object>(deps: T, signal: AbortSignal): T {
  const guarded = { ...deps } as Record<string, unknown>;
  for (const [name, provider] of Object.entries(guarded)) {
    if (!provider || typeof provider !== "object") continue;
    guarded[name] = Object.fromEntries(
      Object.entries(provider).map(([key, value]) => [
        key,
        typeof value === "function"
          ? (...args: unknown[]) => {
              signal.throwIfAborted();
              return (value as (...a: unknown[]) => unknown).apply(provider, args);
            }
          : value,
      ]),
    );
  }
  return guarded as T;
}

/**
 * The automations are a beta behind Settings → "Board automations (beta)". Off, nothing of the
 * board watcher runs: no look, no review or test session, no notice, and its routes refuse.
 * Turning it off while something runs aborts it through `automationSignal()`.
 */

let controller = new AbortController();

export async function automationsOn(): Promise<boolean> {
  const prefs = await getUserPreferences().catch(() => null);
  return prefs?.boardAutomations === true;
}

/** Aborts with the switch: passed to the Claude sessions the watcher spawns. */
export function automationSignal(): AbortSignal {
  return controller.signal;
}

/** Sync check for the places that can't wait on the preferences file (sending a notice). */
export function automationsStopped(): boolean {
  return controller.signal.aborted;
}

export function stopAutomations(): void {
  if (!controller.signal.aborted) controller.abort(new Error("Board automations turned off"));
}

/** A fresh signal for the next run, after a stop. */
export function rearmAutomations(): void {
  if (controller.signal.aborted) controller = new AbortController();
}
