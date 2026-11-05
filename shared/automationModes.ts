import type { AutomationFeatures, AutomationLive } from "./boardWatcher.js";

/**
 * One mode per automation (off, simulation, for real) over the switches `boardWatcher.json`
 * keeps: an automation's switch says whether it looks and decides, its real-action switches
 * whether what it decides is done. The file's format doesn't change; this only reads and writes
 * those switches together.
 */

export type AutomationMode = "off" | "simulate" | "live";

export const MODE_AUTOMATIONS = ["codeReview", "devQueue", "testQueue", "rebuild"] as const;
export type ModeAutomation = (typeof MODE_AUTOMATIONS)[number];

export type Switches = { features: AutomationFeatures; live: AutomationLive };
export type SwitchesInput = {
  features: Partial<AutomationFeatures>;
  live: Partial<AutomationLive>;
};

/** The automation's own switch and the real actions that belong to it. */
const PARTS: Record<
  ModeAutomation,
  { feature: keyof AutomationFeatures; live: (keyof AutomationLive)[] }
> = {
  codeReview: { feature: "codeReview", live: ["comments", "approve"] },
  devQueue: { feature: "devQueue", live: ["devQueue", "startProgress"] },
  testQueue: { feature: "testQueue", live: ["testClaim"] },
  rebuild: { feature: "rebuild", live: ["rebuild"] },
};

/** The real action that makes an automation "for real" (the others are options of it). */
const MAIN_LIVE: Record<ModeAutomation, (keyof AutomationLive)[]> = {
  codeReview: ["comments", "approve"],
  devQueue: ["devQueue"],
  testQueue: ["testClaim"],
  rebuild: ["rebuild"],
};

/** A real action on while the automation itself is off does nothing: that reads as off. */
export function modeOf(automation: ModeAutomation, { features, live }: Switches): AutomationMode {
  if (!features[PARTS[automation].feature]) return "off";
  return MAIN_LIVE[automation].some((key) => live[key]) ? "live" : "simulate";
}

/** The switches to save for `mode`. Going for real turns on every real action of it (the card's
 *  options can turn one back off); the code review always runs its Claude session then. */
export function switchesForMode(automation: ModeAutomation, mode: AutomationMode): SwitchesInput {
  const { feature, live: actions } = PARTS[automation];
  const features: Partial<AutomationFeatures> = { [feature]: mode !== "off" };
  const live: Partial<AutomationLive> = Object.fromEntries(
    actions.map((key) => [key, mode === "live"]),
  );
  // Simulating or doing it for real, the code review is a real Claude review; "only list the
  // PRs" is an option of the simulation.
  if (automation === "codeReview" && mode !== "off") features.reviewSessions = true;
  return { features, live };
}

export function applySwitches(current: Switches, input: SwitchesInput): Switches {
  return {
    features: { ...current.features, ...input.features },
    live: { ...current.live, ...input.live },
  };
}
