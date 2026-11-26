import os from "node:os";
import type { OrchestratorPreferences } from "../../shared/preferences.js";

const GIB = 1024 ** 3;

/**
 * Auto preview limits (`heavyLimits: "auto"`): RAM cap per preview container and how many run at
 * once. Mirrored in `scripts/heavy-run-auto.mjs`, which heavy-run uses for `--preview`; keep the two
 * formulas in sync.
 */
export function autoPreviewLimits(totalMemoryGb: number): { memoryGb: number; slots: number } {
  const memoryGb = Math.min(8, Math.max(4, Math.floor(totalMemoryGb * 0.2)));
  const slots = Math.max(1, Math.floor((totalMemoryGb * 0.4) / memoryGb));
  return { memoryGb, slots };
}

/** Preview slots a start must respect: the auto formula, or the manual `previewSlots`. */
export function previewSlotsFor(orchestrator: OrchestratorPreferences): number {
  if (orchestrator.heavyLimits === "manual") return orchestrator.previewSlots;
  return autoPreviewLimits(os.totalmem() / GIB).slots;
}
