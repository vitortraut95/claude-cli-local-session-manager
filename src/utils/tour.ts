const SEEN_KEY = "onboarding.tour.v1";

/** Whether this browser already finished or skipped the welcome tour (it then only starts from
 *  the Guide). */
export function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage refused (private window): don't show it on every load.
    return true;
  }
}

export function markTourSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // The tour just shows again next time.
  }
}
