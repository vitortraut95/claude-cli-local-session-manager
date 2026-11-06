import { useCallback, useEffect, useState } from "react";

/** The app's pages. Sessions is the home; the rest are reached from the navigation. */
export type AppView = "sessions" | "board" | "queue" | "guide";

const VIEWS: readonly AppView[] = ["sessions", "board", "queue", "guide"];
const PARAM = "view";

function readView(): AppView {
  const raw = new URLSearchParams(window.location.search).get(PARAM);
  return VIEWS.includes(raw as AppView) ? (raw as AppView) : "sessions";
}

/**
 * The current page, kept in `?view=` so a reload stays on it. Unlike the list's filters (replaced
 * in place), changing page pushes a history entry: the browser's back button returns to the page
 * before.
 */
export function useAppView(): [AppView, (view: AppView) => void] {
  const [view, setViewState] = useState<AppView>(readView);

  useEffect(() => {
    const onPopState = () => setViewState(readView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setView = useCallback((next: AppView) => {
    setViewState(next);
    if (readView() === next) return;
    const params = new URLSearchParams(window.location.search);
    if (next === "sessions") params.delete(PARAM);
    else params.set(PARAM, next);
    const query = params.toString();
    window.history.pushState(
      window.history.state,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
    window.scrollTo({ top: 0 });
  }, []);

  return [view, setView];
}
