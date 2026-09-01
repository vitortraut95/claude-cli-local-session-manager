import { useCallback, useEffect, useState } from "react";

function readParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

// replaceState (not pushState) on every change, so paging/filtering never spams
// browser history — the back button leaves the sessions page, not the last filter tweak.
function writeParam(key: string, value: string, defaultValue: string): void {
  const params = new URLSearchParams(window.location.search);
  if (value === defaultValue) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(window.history.state, "", url);
}

export function useUrlParam(key: string, defaultValue: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readParam(key) ?? defaultValue);

  useEffect(() => {
    const onPopState = () => setValue(readParam(key) ?? defaultValue);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key, defaultValue]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      writeParam(key, next, defaultValue);
    },
    [key, defaultValue],
  );

  return [value, update];
}
