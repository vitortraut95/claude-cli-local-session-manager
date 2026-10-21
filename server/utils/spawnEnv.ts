const SNAP_ORIG_SUFFIX = "_VSCODE_SNAP_ORIG";

/**
 * Env for the terminals the app opens (and so every `claude` in them):
 * - undoes snap VS Code's env overrides (GTK_PATH, LOCPATH, ...; originals kept in
 *   `<VAR>_VSCODE_SNAP_ORIG`) when the server runs in its terminal: a GTK terminal spawned under
 *   them fails with symbol errors like `undefined symbol: __libc_pthread_init`;
 * - drops `FORCE_COLOR`, which `concurrently` (`yarn dev`) sets for the server: inherited, it makes
 *   every Node tool the sessions run print ANSI colors into pipes and captured output.
 */
export function sanitizedSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.FORCE_COLOR;
  if (process.platform !== "linux") return env;

  for (const key of Object.keys(env)) {
    if (!key.endsWith(SNAP_ORIG_SUFFIX)) continue;
    const originalVar = key.slice(0, -SNAP_ORIG_SUFFIX.length);
    const originalValue = env[key];
    if (originalValue) {
      env[originalVar] = originalValue;
    } else {
      delete env[originalVar];
    }
  }
  return env;
}
