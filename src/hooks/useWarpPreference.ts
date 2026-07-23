import { useCallback, useState } from "react";

const STORAGE_KEY = "useWarpTerminal";

/**
 * Defaults to on (Warp) when the user hasn't chosen yet. Read directly by sessionsApi at call
 * time, so the API layer doesn't need this as a React hook.
 */
export function getWarpPreference(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

function setWarpPreference(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value));
}

export function useWarpPreference() {
  const [useWarp, setUseWarpState] = useState<boolean>(getWarpPreference);

  const toggleWarp = useCallback(() => {
    setUseWarpState((current) => {
      const next = !current;
      setWarpPreference(next);
      return next;
    });
  }, []);

  return { useWarp, toggleWarp };
}
